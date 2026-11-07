import { useState } from 'react'
import { Badge, Barra, Campo, Kpi, Modal, PageHeader, Tabs, Vazio, notificar } from '../components/ui'
import { antecipacaoGarantida, aplicarReajuste, baixarFatura, executarRegua, gerarFaturas, realizarRepasse, salvarItem, update, useDB, valorFaturaContrato } from '../lib/store'
import { addMeses, brl, competenciaBR, dataBR, dataHoraBR, diffDias, diffMeses, downloadArquivo, hoje, pct, round2, uid } from '../lib/format'
import type { Contrato, DB, Indice, ReguaRegra } from '../lib/types'

const nome = (db: DB, id?: string) => db.pessoas.find(p => p.id === id)?.nome ?? '—'
const indices: Indice[] = ['IGP-M', 'IPCA', 'INPC', 'IVAR']

export function proximoReajuste(c: Contrato) {
  const ultimo = c.historicoReajustes[0]?.em ?? c.inicio
  return addMeses(c.historicoReajustes[0] ? ultimo : c.inicio, 12)
}

/** Multa rescisória proporcional ao tempo restante (base: 3 aluguéis). */
export function calcularRescisao(c: Contrato, data: string, mesesMulta = 3) {
  const decorridos = Math.max(0, diffMeses(data, c.inicio))
  const restantes = Math.max(0, c.duracaoMeses - decorridos)
  const multa = round2(c.valorAluguel * mesesMulta * (restantes / c.duracaoMeses))
  const dia = Number(data.slice(8, 10))
  const proporcional = round2(c.valorAluguel / 30 * Math.min(dia, 30))
  return { decorridos, restantes, multa, proporcional, total: round2(multa + proporcional) }
}

/* ---------------- Contratos ---------------- */
export function Contratos() {
  const db = useDB(d => d)
  const [edit, setEdit] = useState<Contrato | null>(null)
  const [detalhe, setDetalhe] = useState<string | null>(null)
  const novo = (): Contrato => ({ id: uid(), codigo: `LOC-${String(db.contratos.length + 1).padStart(3, '0')}`, imovelId: '', proprietarioId: '', inquilinoId: '', valorAluguel: 0, taxaAdm: 10, taxaPrimeiroAluguel: 100, diaVencimento: 10, inicio: hoje(), duracaoMeses: 30, indice: 'IGP-M', garantia: 'Seguro fiança', seguroIncendio: { ativo: false, seguradora: '', vencimento: addMeses(hoje(), 12), valorMensal: 0 }, repasseGarantido: false, status: 'ativo', extras: [], historicoReajustes: [] })
  const c = db.contratos.find(c => c.id === detalhe)
  return <>
    <PageHeader titulo="Contratos de locação" sub={`${db.contratos.filter(c => c.status === 'ativo').length} contratos ativos`} acoes={<button className="btn-primary" onClick={() => setEdit(novo())}>+ Novo contrato</button>} />
    {db.contratos.length === 0 ? <Vazio texto="Nenhum contrato." /> : <div className="card overflow-x-auto p-0"><table className="table">
      <thead><tr><th>Código</th><th>Imóvel</th><th>Proprietário</th><th>Inquilino</th><th>Aluguel</th><th>Taxa</th><th>Próx. reajuste</th><th>Status</th><th></th></tr></thead>
      <tbody>{db.contratos.map(c => {
        const pr = proximoReajuste(c)
        return <tr key={c.id}>
          <td className="font-bold">{c.codigo}</td><td>{db.imoveis.find(i => i.id === c.imovelId)?.codigo}</td><td>{nome(db, c.proprietarioId)}</td><td>{nome(db, c.inquilinoId)}</td>
          <td className="font-semibold">{brl(c.valorAluguel)}</td><td>{pct(c.taxaAdm)}</td>
          <td>{c.status === 'ativo' && pr <= addMeses(hoje(), 1) ? <Badge cor="amarelo">{dataBR(pr)}</Badge> : dataBR(pr)}</td>
          <td><Badge cor={c.status === 'ativo' ? 'verde' : 'cinza'}>{c.status}</Badge></td>
          <td className="whitespace-nowrap"><button className="mr-3 text-sm font-semibold underline" onClick={() => setDetalhe(c.id)}>Abrir</button><button className="text-sm font-semibold underline" onClick={() => setEdit(c)}>Editar</button></td>
        </tr>
      })}</tbody></table></div>}
    {edit && <ContratoForm contrato={edit} onFechar={() => setEdit(null)} />}
    {c && <ContratoDetalhe c={c} onFechar={() => setDetalhe(null)} />}
  </>
}

function ContratoForm({ contrato, onFechar }: { contrato: Contrato; onFechar: () => void }) {
  const db = useDB(d => d)
  const [c, setC] = useState(contrato)
  const set = (p: Partial<Contrato>) => setC({ ...c, ...p })
  return (
    <Modal aberto onFechar={onFechar} titulo={`Contrato ${c.codigo}`} largura="max-w-4xl">
      <form className="grid gap-4 sm:grid-cols-4" onSubmit={e => {
        e.preventDefault(); salvarItem('contratos', c)
        update(d => { const i = d.imoveis.find(i => i.id === c.imovelId); if (i && c.status === 'ativo') i.status = 'alugado'; d.pessoas.filter(p => p.id === c.inquilinoId && !p.tipos.includes('inquilino')).forEach(p => p.tipos.push('inquilino')) })
        notificar('Contrato salvo'); onFechar()
      }}>
        <Campo label="Código"><input className="input" value={c.codigo} onChange={e => set({ codigo: e.target.value })} /></Campo>
        <Campo label="Imóvel" className="sm:col-span-3"><select required className="input" value={c.imovelId} onChange={e => { const im = db.imoveis.find(i => i.id === e.target.value); set({ imovelId: e.target.value, proprietarioId: im?.proprietarioId ?? c.proprietarioId, valorAluguel: c.valorAluguel || (im?.finalidade === 'aluguel' ? im.preco : 0) }) }}><option value="">Selecione…</option>{db.imoveis.map(i => <option key={i.id} value={i.id}>{i.codigo} · {i.titulo}</option>)}</select></Campo>
        <Campo label="Proprietário (locador)" className="sm:col-span-2"><select required className="input" value={c.proprietarioId} onChange={e => set({ proprietarioId: e.target.value })}><option value="">Selecione…</option>{db.pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
        <Campo label="Inquilino (locatário)" className="sm:col-span-2"><select required className="input" value={c.inquilinoId} onChange={e => set({ inquilinoId: e.target.value })}><option value="">Selecione…</option>{db.pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
        <Campo label="Aluguel (R$)"><input type="number" step="0.01" className="input" value={c.valorAluguel} onChange={e => set({ valorAluguel: Number(e.target.value) })} /></Campo>
        <Campo label="Taxa de adm. (%)"><input type="number" step="0.1" className="input" value={c.taxaAdm} onChange={e => set({ taxaAdm: Number(e.target.value) })} /></Campo>
        <Campo label="1º aluguel retido (%)"><input type="number" className="input" value={c.taxaPrimeiroAluguel} onChange={e => set({ taxaPrimeiroAluguel: Number(e.target.value) })} /></Campo>
        <Campo label="Dia de vencimento"><input type="number" min={1} max={28} className="input" value={c.diaVencimento} onChange={e => set({ diaVencimento: Number(e.target.value) })} /></Campo>
        <Campo label="Início"><input type="date" className="input" value={c.inicio} onChange={e => set({ inicio: e.target.value })} /></Campo>
        <Campo label="Duração (meses)"><input type="number" className="input" value={c.duracaoMeses} onChange={e => set({ duracaoMeses: Number(e.target.value) })} /></Campo>
        <Campo label="Índice de reajuste"><select className="input" value={c.indice} onChange={e => set({ indice: e.target.value as Indice })}>{indices.map(i => <option key={i}>{i}</option>)}</select></Campo>
        <Campo label="Garantia"><select className="input" value={c.garantia} onChange={e => set({ garantia: e.target.value })}>{['Seguro fiança', 'Caução (3 aluguéis)', 'Fiador', 'Título de capitalização', 'Sem garantia'].map(g => <option key={g}>{g}</option>)}</select></Campo>
        <div className="sm:col-span-4">
          <div className="label">Encargos cobrados na fatura</div>
          {c.extras.map((x, n) => <div key={n} className="mb-2 flex gap-2"><input className="input" value={x.descricao} onChange={e => set({ extras: c.extras.map((y, m) => m === n ? { ...y, descricao: e.target.value } : y) })} /><input type="number" className="input w-40" value={x.valor} onChange={e => set({ extras: c.extras.map((y, m) => m === n ? { ...y, valor: Number(e.target.value) } : y) })} /><button type="button" className="btn-danger" onClick={() => set({ extras: c.extras.filter((_, m) => m !== n) })}>×</button></div>)}
          <button type="button" className="btn-ghost" onClick={() => set({ extras: [...c.extras, { descricao: 'Condomínio', valor: 0 }] })}>+ Encargo</button>
        </div>
        <div className="rounded-xl bg-neutral-50 p-4 sm:col-span-4">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-ink" checked={c.seguroIncendio.ativo} onChange={e => set({ seguroIncendio: { ...c.seguroIncendio, ativo: e.target.checked } })} />Seguro incêndio</label>
          {c.seguroIncendio.ativo && <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Campo label="Seguradora"><input className="input" value={c.seguroIncendio.seguradora} onChange={e => set({ seguroIncendio: { ...c.seguroIncendio, seguradora: e.target.value } })} /></Campo>
            <Campo label="Vencimento da apólice"><input type="date" className="input" value={c.seguroIncendio.vencimento} onChange={e => set({ seguroIncendio: { ...c.seguroIncendio, vencimento: e.target.value } })} /></Campo>
            <Campo label="Valor mensal"><input type="number" className="input" value={c.seguroIncendio.valorMensal} onChange={e => set({ seguroIncendio: { ...c.seguroIncendio, valorMensal: Number(e.target.value) } })} /></Campo>
          </div>}
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-ink" checked={c.repasseGarantido} onChange={e => set({ repasseGarantido: e.target.checked })} />Repasse garantido (proprietário recebe no vencimento mesmo sem pagamento do inquilino)</label>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-4"><button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary">Salvar contrato</button></div>
      </form>
    </Modal>
  )
}

function ContratoDetalhe({ c, onFechar }: { c: Contrato; onFechar: () => void }) {
  const db = useDB(d => d)
  const [aba, setAba] = useState<'resumo' | 'reajuste' | 'rescisao' | 'documento'>('resumo')
  const [percentual, setPercentual] = useState(db.config.indices[c.indice])
  const [dataResc, setDataResc] = useState(hoje())
  const [mesesMulta, setMesesMulta] = useState(3)
  const imovel = db.imoveis.find(i => i.id === c.imovelId)
  const faturas = db.faturas.filter(f => f.contratoId === c.id)
  const resc = calcularRescisao(c, dataResc, mesesMulta)
  const novoValor = round2(c.valorAluguel * (1 + percentual / 100))
  const texto = `CONTRATO DE LOCAÇÃO RESIDENCIAL — ${c.codigo}

LOCADOR: ${nome(db, c.proprietarioId)}, CPF/CNPJ ${db.pessoas.find(p => p.id === c.proprietarioId)?.documento ?? ''}
LOCATÁRIO: ${nome(db, c.inquilinoId)}, CPF/CNPJ ${db.pessoas.find(p => p.id === c.inquilinoId)?.documento ?? ''}
ADMINISTRADORA: ${db.site.nome}

IMÓVEL: ${imovel?.endereco}, ${imovel?.bairro}, ${imovel?.cidade}.

1. PRAZO: ${c.duracaoMeses} meses, com início em ${dataBR(c.inicio)} e término em ${dataBR(addMeses(c.inicio, c.duracaoMeses))}.
2. ALUGUEL: ${brl(c.valorAluguel)} mensais, com vencimento todo dia ${c.diaVencimento}.
3. REAJUSTE: anual, pela variação acumulada do ${c.indice}.
4. ENCARGOS: ${c.extras.map(e => `${e.descricao} (${brl(e.valor)})`).join(', ') || 'não há'}${c.seguroIncendio.ativo ? `; seguro incêndio (${brl(c.seguroIncendio.valorMensal)}/mês)` : ''}.
5. GARANTIA: ${c.garantia}.
6. RESCISÃO ANTECIPADA: multa equivalente a 3 aluguéis, proporcional ao tempo restante do contrato.

${db.site.endereco}, ${dataBR(hoje())}.

_____________________________          _____________________________
LOCADOR                                LOCATÁRIO`
  return (
    <Modal aberto onFechar={onFechar} titulo={`${c.codigo} · ${imovel?.titulo ?? ''}`} largura="max-w-4xl">
      <Tabs abas={[{ id: 'resumo', nome: 'Resumo' }, { id: 'reajuste', nome: 'Reajuste' }, { id: 'rescisao', nome: 'Rescisão' }, { id: 'documento', nome: 'Documento' }]} ativa={aba} onChange={setAba} />
      {aba === 'resumo' && <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi titulo="Aluguel" valor={brl(c.valorAluguel)} detalhe={`Vence dia ${c.diaVencimento}`} />
          <Kpi titulo="Fatura mensal" valor={brl(valorFaturaContrato(c).reduce((s, i) => s + i.valor, 0))} detalhe="Com encargos" />
          <Kpi titulo="Término" valor={dataBR(addMeses(c.inicio, c.duracaoMeses))} detalhe={`${c.duracaoMeses} meses · ${c.indice}`} />
        </div>
        <div className="text-sm"><b>Locador:</b> {nome(db, c.proprietarioId)} · <b>Locatário:</b> {nome(db, c.inquilinoId)} · <b>Garantia:</b> {c.garantia}{c.repasseGarantido && <> · <Badge cor="preto">repasse garantido</Badge></>}</div>
        <h3 className="font-black">Faturas</h3>
        <table className="table"><thead><tr><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>{faturas.map(f => <tr key={f.id}><td>{competenciaBR(f.competencia)}</td><td>{dataBR(f.vencimento)}</td><td>{brl(f.valor)}</td><td><StatusFatura f={f} /></td></tr>)}</tbody></table>
        {c.status === 'ativo' && <button className="btn-danger" onClick={() => { if (confirm('Encerrar este contrato?')) { update(d => { const x = d.contratos.find(x => x.id === c.id)!; x.status = 'encerrado'; x.encerradoEm = hoje(); const i = d.imoveis.find(i => i.id === x.imovelId); if (i) i.status = 'disponivel' }); onFechar() } }}>Encerrar contrato</button>}
      </div>}
      {aba === 'reajuste' && <div className="space-y-4">
        <p className="text-sm text-ink-muted">Próximo reajuste previsto em <b>{dataBR(proximoReajuste(c))}</b> pelo {c.indice}. Simule antes de aplicar.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo label={`Variação acumulada ${c.indice} (%)`}><input type="number" step="0.01" className="input" value={percentual} onChange={e => setPercentual(Number(e.target.value))} /></Campo>
          <Kpi titulo="Valor atual" valor={brl(c.valorAluguel)} /><Kpi destaque titulo="Novo valor" valor={brl(novoValor)} detalhe={`+ ${brl(novoValor - c.valorAluguel)}`} />
        </div>
        <button className="btn-primary" onClick={() => { aplicarReajuste(c.id, percentual); notificar(`Reajuste aplicado: ${brl(novoValor)}`) }}>Aplicar reajuste</button>
        <h3 className="font-black">Histórico</h3>
        {c.historicoReajustes.length ? <table className="table"><thead><tr><th>Data</th><th>Índice</th><th>%</th><th>De</th><th>Para</th></tr></thead><tbody>{c.historicoReajustes.map((h, i) => <tr key={i}><td>{dataBR(h.em)}</td><td>{h.indice}</td><td>{pct(h.percentual)}</td><td>{brl(h.de)}</td><td>{brl(h.para)}</td></tr>)}</tbody></table> : <p className="text-sm text-ink-muted">Nenhum reajuste aplicado.</p>}
      </div>}
      {aba === 'rescisao' && <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Data de saída"><input type="date" className="input" value={dataResc} onChange={e => setDataResc(e.target.value)} /></Campo>
          <Campo label="Multa (nº de aluguéis)"><input type="number" className="input" value={mesesMulta} onChange={e => setMesesMulta(Number(e.target.value))} /></Campo>
        </div>
        <table className="table"><tbody>
          <tr><td>Meses cumpridos</td><td className="text-right">{resc.decorridos} de {c.duracaoMeses}</td></tr>
          <tr><td>Meses restantes</td><td className="text-right">{resc.restantes}</td></tr>
          <tr><td>Multa proporcional ({mesesMulta} aluguéis × {resc.restantes}/{c.duracaoMeses})</td><td className="text-right">{brl(resc.multa)}</td></tr>
          <tr><td>Aluguel proporcional do mês de saída</td><td className="text-right">{brl(resc.proporcional)}</td></tr>
          <tr className="font-black"><td>Total estimado</td><td className="text-right">{brl(resc.total)}</td></tr>
        </tbody></table>
        <p className="text-xs text-ink-muted">Cálculo de referência; confira as cláusulas do contrato.</p>
      </div>}
      {aba === 'documento' && <div>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 font-sans text-sm">{texto}</pre>
        <div className="mt-3 flex gap-2">
          <button className="btn-dark" onClick={() => downloadArquivo(`${c.codigo}.txt`, texto)}>Baixar contrato</button>
          <button className="btn-ghost" onClick={() => { const w = window.open('', '_blank'); if (w) { w.document.write(`<pre style="font-family:Arial;white-space:pre-wrap;padding:40px">${texto.replace(/</g, '&lt;')}</pre>`); w.print() } }}>Imprimir</button>
          <button className="btn-primary" onClick={() => notificar('Documento enviado para assinatura eletrônica (simulação)')}>Enviar para assinatura</button>
        </div>
      </div>}
    </Modal>
  )
}

/* ---------------- Faturas ---------------- */
function StatusFatura({ f }: { f: { status: string; vencimento: string } }) {
  if (f.status === 'paga') return <Badge cor="verde">Paga</Badge>
  if (f.status === 'cancelada') return <Badge>Cancelada</Badge>
  const atraso = diffDias(hoje(), f.vencimento)
  return atraso > 0 ? <Badge cor="vermelho">Atrasada {atraso}d</Badge> : <Badge cor="amarelo">Aberta</Badge>
}

export function Faturas() {
  const db = useDB(d => d)
  const [aba, setAba] = useState<'faturas' | 'regua'>('faturas')
  const [comp, setComp] = useState(hoje().slice(0, 7))
  const [filtro, setFiltro] = useState('')
  const [boleto, setBoleto] = useState<string | null>(null)
  const lista = db.faturas.filter(f => (!comp || f.competencia === comp) && (!filtro || (filtro === 'atrasada' ? f.status === 'aberta' && f.vencimento < hoje() : f.status === filtro)))
  const fb = db.faturas.find(f => f.id === boleto)
  return <>
    <PageHeader titulo="Faturas e cobrança" sub="Geração mensal, baixa de pagamentos e régua de cobrança" acoes={<>
      <button className="btn-ghost" onClick={() => notificar(`${executarRegua()} notificações enviadas pela régua`)}>Executar régua agora</button>
      <button className="btn-primary" onClick={() => notificar(`${gerarFaturas(comp || hoje().slice(0, 7))} faturas geradas`)}>Gerar faturas de {competenciaBR(comp || hoje().slice(0, 7))}</button>
    </>} />
    <Tabs abas={[{ id: 'faturas', nome: 'Faturas' }, { id: 'regua', nome: 'Régua de cobrança' }]} ativa={aba} onChange={setAba} />
    {aba === 'faturas' && <>
      <div className="mb-4 flex flex-wrap gap-2">
        <input type="month" className="input w-auto" value={comp} onChange={e => setComp(e.target.value)} />
        <select className="input w-auto" value={filtro} onChange={e => setFiltro(e.target.value)}><option value="">Todos os status</option><option value="aberta">Abertas</option><option value="atrasada">Atrasadas</option><option value="paga">Pagas</option></select>
      </div>
      {lista.length === 0 ? <Vazio texto="Nenhuma fatura nesta competência. Clique em “Gerar faturas”." /> : <div className="card overflow-x-auto p-0"><table className="table">
        <thead><tr><th>Contrato</th><th>Inquilino</th><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Avisos</th><th></th></tr></thead>
        <tbody>{lista.map(f => { const c = db.contratos.find(c => c.id === f.contratoId); return (
          <tr key={f.id}><td className="font-bold">{c?.codigo}</td><td>{nome(db, c?.inquilinoId)}</td><td>{competenciaBR(f.competencia)}</td><td>{dataBR(f.vencimento)}</td><td className="font-semibold">{brl(f.valor)}</td><td><StatusFatura f={f} /></td><td>{f.notificacoes.length}</td>
            <td className="whitespace-nowrap"><button className="mr-3 text-sm font-semibold underline" onClick={() => setBoleto(f.id)}>Boleto</button>{f.status === 'aberta' && <button className="btn-primary px-3 py-1" onClick={() => { baixarFatura(f.id); notificar('Pagamento registrado e repasse gerado') }}>Dar baixa</button>}</td></tr>
        ) })}</tbody></table></div>}
    </>}
    {aba === 'regua' && <ReguaConfig />}
    {fb && <Modal aberto onFechar={() => setBoleto(null)} titulo="Boleto / PIX">
      {(() => { const c = db.contratos.find(c => c.id === fb.contratoId)!; const linha = `00190.00009 0${c.codigo.replace(/\D/g, '').padStart(4, '0')}.${fb.competencia.replace('-', '')} 0000${Math.round(fb.valor * 100)}`; return <div className="space-y-3 text-sm">
        <div className="flex justify-between"><span>Beneficiário</span><b>{db.site.nome}</b></div>
        <div className="flex justify-between"><span>Pagador</span><b>{nome(db, c.inquilinoId)}</b></div>
        <div className="flex justify-between"><span>Vencimento</span><b>{dataBR(fb.vencimento)}</b></div>
        <table className="table"><tbody>{fb.itens.map((i, n) => <tr key={n}><td>{i.descricao}</td><td className="text-right">{brl(i.valor)}</td></tr>)}<tr className="font-black"><td>Total</td><td className="text-right">{brl(fb.valor)}</td></tr></tbody></table>
        <div className="rounded-lg bg-neutral-100 p-3 font-mono text-xs">{linha}</div>
        <div className="text-xs text-ink-muted">Linha digitável ilustrativa. Para emitir boletos e PIX reais é preciso integrar um banco ou gateway de pagamento.</div>
        {fb.notificacoes.length > 0 && <><h3 className="font-black">Avisos enviados</h3><ul>{fb.notificacoes.map((n, i) => <li key={i}>{dataHoraBR(n.em)} · {n.canal}</li>)}</ul></>}
      </div> })()}
    </Modal>}
  </>
}

function ReguaConfig() {
  const regua = useDB(d => d.config.regua)
  const set = (id: string, p: Partial<ReguaRegra>) => update(d => { Object.assign(d.config.regua.find(r => r.id === id)!, p) })
  return <div className="card space-y-3">
    <p className="text-sm text-ink-muted">Dias negativos = antes do vencimento, 0 = no dia, positivos = depois. Variáveis: {'{inquilino}'}, {'{valor}'}, {'{vencimento}'}.</p>
    {[...regua].sort((a, b) => a.dias - b.dias).map(r => (
      <div key={r.id} className="grid items-center gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[auto_90px_130px_1fr_auto]">
        <input type="checkbox" className="h-5 w-5 accent-ink" checked={r.ativa} onChange={e => set(r.id, { ativa: e.target.checked })} />
        <input type="number" className="input" value={r.dias} onChange={e => set(r.id, { dias: Number(e.target.value) })} />
        <select className="input" value={r.canal} onChange={e => set(r.id, { canal: e.target.value as ReguaRegra['canal'] })}><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></select>
        <input className="input" value={r.mensagem} onChange={e => set(r.id, { mensagem: e.target.value })} />
        <button className="btn-danger" onClick={() => update(d => { d.config.regua = d.config.regua.filter(x => x.id !== r.id) })}>×</button>
      </div>
    ))}
    <button className="btn-ghost" onClick={() => update(d => { d.config.regua.push({ id: uid(), dias: 1, canal: 'email', mensagem: 'Olá {inquilino}, ...', ativa: true }) })}>+ Regra</button>
  </div>
}

/* ---------------- Repasses ---------------- */
export function Repasses() {
  const db = useDB(d => d)
  const [prop, setProp] = useState('')
  const lista = db.repasses.filter(r => !prop || r.proprietarioId === prop)
  const pendente = lista.filter(r => r.status === 'pendente').reduce((s, r) => s + r.valorLiquido, 0)
  return <>
    <PageHeader titulo="Repasses aos proprietários" sub="Valor líquido = fatura recebida − taxa da imobiliária" acoes={<button className="btn-primary" onClick={() => notificar(`${antecipacaoGarantida()} repasses garantidos antecipados`)}>Processar repasse garantido</button>} />
    <div className="mb-4 grid gap-4 sm:grid-cols-3">
      <Kpi destaque titulo="A repassar" valor={brl(pendente)} />
      <Kpi titulo="Repassado no mês" valor={brl(lista.filter(r => r.realizadoEm?.slice(0, 7) === hoje().slice(0, 7)).reduce((s, r) => s + r.valorLiquido, 0))} />
      <Kpi titulo="Taxas retidas" valor={brl(lista.reduce((s, r) => s + r.taxa, 0))} />
    </div>
    <select className="input mb-4 w-auto" value={prop} onChange={e => setProp(e.target.value)}><option value="">Todos os proprietários</option>{db.pessoas.filter(p => p.tipos.includes('proprietario')).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
    {lista.length === 0 ? <Vazio texto="Os repasses aparecem quando uma fatura é paga (ou pelo repasse garantido)." /> : <div className="card overflow-x-auto p-0"><table className="table">
      <thead><tr><th>Contrato</th><th>Proprietário</th><th>Competência</th><th>Bruto</th><th>Taxa</th><th>Líquido</th><th>Previsto</th><th>Status</th><th></th></tr></thead>
      <tbody>{lista.map(r => { const f = db.faturas.find(f => f.id === r.faturaId); return (
        <tr key={r.id}><td className="font-bold">{db.contratos.find(c => c.id === r.contratoId)?.codigo}</td><td>{nome(db, r.proprietarioId)}</td><td>{f && competenciaBR(f.competencia)}</td><td>{brl(r.valorBruto)}</td><td>−{brl(r.taxa)}</td><td className="font-semibold">{brl(r.valorLiquido)}</td><td>{dataBR(r.previsto)}</td>
          <td>{r.status === 'realizado' ? <Badge cor="verde">Realizado {dataBR(r.realizadoEm)}</Badge> : <Badge cor="amarelo">Pendente</Badge>}{r.garantido && <> <Badge cor="preto">garantido</Badge></>}</td>
          <td>{r.status === 'pendente' && <button className="btn-dark px-3 py-1" onClick={() => { realizarRepasse(r.id); notificar('Repasse realizado') }}>Repassar</button>}</td></tr>
      ) })}</tbody></table></div>}
  </>
}

/* ---------------- Carteira, análises e DIMOB ---------------- */
export function Carteira() {
  const db = useDB(d => d)
  const [ano, setAno] = useState(Number(hoje().slice(0, 4)))
  const ativos = db.contratos.filter(c => c.status === 'ativo')
  const abertas = db.faturas.filter(f => f.status === 'aberta')
  const vencidas = abertas.filter(f => f.vencimento < hoje())
  const totalFat = db.faturas.filter(f => f.status !== 'cancelada').reduce((s, f) => s + f.valor, 0)
  const inad = totalFat ? vencidas.reduce((s, f) => s + f.valor, 0) / totalFat * 100 : 0
  const seguros = ativos.filter(c => c.seguroIncendio.ativo && diffDias(c.seguroIncendio.vencimento, hoje()) <= 60)
  const terminando = ativos.filter(c => diffDias(addMeses(c.inicio, c.duracaoMeses), hoje()) <= 90)
  const mapa = db.faturas.filter(f => f.competencia.startsWith(String(ano)))
  const porMes = Array.from({ length: 12 }, (_, m) => {
    const comp = `${ano}-${String(m + 1).padStart(2, '0')}`
    const fs = mapa.filter(f => f.competencia === comp)
    const reps = db.repasses.filter(r => fs.some(f => f.id === r.faturaId))
    return { comp, cobrado: fs.reduce((s, f) => s + f.valor, 0), imob: reps.reduce((s, r) => s + r.taxa, 0), prop: reps.reduce((s, r) => s + r.valorLiquido, 0) }
  })
  const max = Math.max(1, ...porMes.map(p => p.cobrado))
  const dimob = () => {
    const linhas = ['contrato;locador;doc_locador;locatario;doc_locatario;endereco;aluguel_bruto_ano;comissao_ano']
    for (const c of db.contratos) {
      const fs = db.faturas.filter(f => f.contratoId === c.id && f.status === 'paga' && f.competencia.startsWith(String(ano)))
      if (!fs.length) continue
      const bruto = fs.length * c.valorAluguel
      const com = db.repasses.filter(r => fs.some(f => f.id === r.faturaId)).reduce((s, r) => s + r.taxa, 0)
      const p = db.pessoas.find(x => x.id === c.proprietarioId), q = db.pessoas.find(x => x.id === c.inquilinoId), i = db.imoveis.find(x => x.id === c.imovelId)
      linhas.push([c.codigo, p?.nome, p?.documento, q?.nome, q?.documento, `${i?.endereco} ${i?.bairro} ${i?.cidade}`, bruto.toFixed(2), com.toFixed(2)].join(';'))
    }
    downloadArquivo(`dimob-${ano}.csv`, linhas.join('\n'), 'text/csv')
  }
  return <>
    <PageHeader titulo="Carteira de locação" sub="Inadimplência, seguros, contratos a vencer, mapa de cobranças e DIMOB" acoes={<>
      <select className="input w-auto" value={ano} onChange={e => setAno(Number(e.target.value))}>{[0, 1, 2].map(n => { const a = Number(hoje().slice(0, 4)) - n; return <option key={a}>{a}</option> })}</select>
      <button className="btn-dark" onClick={dimob}>Exportar relatório DIMOB {ano}</button>
    </>} />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi destaque titulo="Contratos ativos" valor={ativos.length} detalhe={brl(ativos.reduce((s, c) => s + c.valorAluguel, 0)) + ' em aluguéis/mês'} />
      <Kpi titulo="Inadimplência" valor={pct(inad)} detalhe={`${vencidas.length} faturas vencidas · ${brl(vencidas.reduce((s, f) => s + f.valor, 0))}`} />
      <Kpi titulo="Seguros a vencer (60d)" valor={seguros.length} />
      <Kpi titulo="Contratos terminando (90d)" valor={terminando.length} />
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="card"><h2 className="mb-4 font-black">Mapa de cobranças {ano}</h2>
        <div className="space-y-2">{porMes.map(p => <Barra key={p.comp} rotulo={competenciaBR(p.comp)} valor={p.cobrado} max={max} extra={brl(p.cobrado)} />)}</div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div>Parte da imobiliária: <b>{brl(porMes.reduce((s, p) => s + p.imob, 0))}</b></div><div>Parte dos proprietários: <b>{brl(porMes.reduce((s, p) => s + p.prop, 0))}</b></div></div>
      </div>
      <div className="card space-y-4">
        <div><h2 className="mb-2 font-black">Seguros e garantias</h2>
          <table className="table"><thead><tr><th>Contrato</th><th>Garantia</th><th>Seguro incêndio</th></tr></thead>
            <tbody>{ativos.map(c => <tr key={c.id}><td>{c.codigo}</td><td>{c.garantia}</td><td>{c.seguroIncendio.ativo ? (diffDias(c.seguroIncendio.vencimento, hoje()) <= 60 ? <Badge cor="vermelho">vence {dataBR(c.seguroIncendio.vencimento)}</Badge> : <Badge cor="verde">até {dataBR(c.seguroIncendio.vencimento)}</Badge>) : <Badge>sem seguro</Badge>}</td></tr>)}</tbody></table></div>
        <div><h2 className="mb-2 font-black">Contratos terminando</h2>{terminando.length ? terminando.map(c => <div key={c.id} className="text-sm">{c.codigo} · termina em {dataBR(addMeses(c.inicio, c.duracaoMeses))}</div>) : <p className="text-sm text-ink-muted">Nenhum nos próximos 90 dias.</p>}</div>
      </div>
    </div>
    <p className="mt-4 text-xs text-ink-muted">O relatório DIMOB traz os totais anuais por contrato para conferência e preenchimento. Não é o arquivo no layout oficial da Receita Federal.</p>
  </>
}
