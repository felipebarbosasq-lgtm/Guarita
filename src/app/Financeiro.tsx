import { useMemo, useState } from 'react'
import { Badge, Campo, Kpi, Modal, PageHeader, Tabs, Vazio, notificar } from '../components/ui'
import { criarLancamentos, saldoConta, update, useDB } from '../lib/store'
import { addMeses, brl, competenciaBR, dataBR, diffDias, hoje, uid } from '../lib/format'
import type { Lancamento } from '../lib/types'

/* ---------------- Contas a pagar / receber ---------------- */
export function Financeiro() {
  const db = useDB(d => d)
  const [tipo, setTipo] = useState<'receber' | 'pagar' | 'transferencia'>('receber')
  const [status, setStatus] = useState('')
  const [de, setDe] = useState(addMeses(hoje(), -2))
  const [ate, setAte] = useState(addMeses(hoje(), 2))
  const [novo, setNovo] = useState(false)
  const lista = db.lancamentos.filter(l => l.tipo === tipo && (!status || l.status === status) && l.vencimento >= de && l.vencimento <= ate).sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  const nomePlano = (id?: string) => db.planoContas.find(p => p.id === id)?.nome ?? '—'
  return <>
    <PageHeader titulo="Contas a pagar e receber" sub="Lançamentos, parcelamentos, recorrências e transferências" acoes={<button className="btn-primary" onClick={() => setNovo(true)}>+ Novo lançamento</button>} />
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {db.contasBancarias.map((c, i) => <Kpi key={c.id} destaque={i === 0} titulo={c.nome} valor={brl(saldoConta(db, c.id))} detalhe={c.banco} />)}
      <Kpi titulo="A receber (pendente)" valor={brl(db.lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pendente').reduce((s, l) => s + l.valor, 0))} />
      <Kpi titulo="A pagar (pendente)" valor={brl(db.lancamentos.filter(l => l.tipo === 'pagar' && l.status === 'pendente').reduce((s, l) => s + l.valor, 0))} />
    </div>
    <Tabs abas={[{ id: 'receber', nome: 'Contas a receber' }, { id: 'pagar', nome: 'Contas a pagar' }, { id: 'transferencia', nome: 'Transferências' }]} ativa={tipo} onChange={setTipo} />
    <div className="mb-4 flex flex-wrap items-end gap-2">
      <Campo label="De"><input type="date" className="input" value={de} onChange={e => setDe(e.target.value)} /></Campo>
      <Campo label="Até"><input type="date" className="input" value={ate} onChange={e => setAte(e.target.value)} /></Campo>
      <Campo label="Status"><select className="input" value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option><option value="pendente">Pendentes</option><option value="quitado">Quitados</option></select></Campo>
    </div>
    {lista.length === 0 ? <Vazio texto="Nenhum lançamento no período." /> : <div className="card overflow-x-auto p-0"><table className="table">
      <thead><tr><th>Vencimento</th><th>Descrição</th><th>Plano de contas</th><th>Centro de custo</th><th>Conta</th><th className="text-right">Valor</th><th>Status</th><th></th></tr></thead>
      <tbody>{lista.map(l => (
        <tr key={l.id}>
          <td>{dataBR(l.vencimento)}</td>
          <td><div className="font-semibold">{l.descricao}{l.parcela && <span className="ml-1 text-xs text-ink-muted">({l.parcela})</span>}</div><div className="text-xs text-ink-muted">{db.pessoas.find(p => p.id === l.pessoaId)?.nome}</div></td>
          <td>{tipo === 'transferencia' ? '—' : nomePlano(l.planoContaId)}</td>
          <td>{db.centrosCusto.find(c => c.id === l.centroCustoId)?.nome ?? '—'}</td>
          <td>{db.contasBancarias.find(c => c.id === l.contaBancariaId)?.nome}{l.contaDestinoId && ' → ' + db.contasBancarias.find(c => c.id === l.contaDestinoId)?.nome}</td>
          <td className={`text-right font-semibold ${l.tipo === 'pagar' ? 'text-red-700' : ''}`}>{l.tipo === 'pagar' ? '−' : ''}{brl(l.valor)}</td>
          <td>{l.status === 'quitado' ? <Badge cor="verde">Quitado {dataBR(l.quitadoEm)}</Badge> : l.vencimento < hoje() ? <Badge cor="vermelho">Vencido</Badge> : <Badge cor="amarelo">Pendente</Badge>}{l.conciliado && <> <Badge cor="preto">conciliado</Badge></>}</td>
          <td className="whitespace-nowrap">
            {l.status === 'pendente' ? <button className="btn-primary px-3 py-1" onClick={() => update(d => { const x = d.lancamentos.find(x => x.id === l.id)!; x.status = 'quitado'; x.quitadoEm = hoje() })}>Quitar</button>
              : <button className="text-sm font-semibold underline" onClick={() => update(d => { const x = d.lancamentos.find(x => x.id === l.id)!; x.status = 'pendente'; x.quitadoEm = undefined; x.conciliado = false })}>Estornar</button>}
            <button className="ml-3 text-sm font-semibold text-red-700 underline" onClick={() => {
              if (l.grupo && confirm('Excluir também as próximas ocorrências pendentes deste grupo?')) update(d => { d.lancamentos = d.lancamentos.filter(x => !(x.grupo === l.grupo && (x.id === l.id || (x.status === 'pendente' && x.vencimento >= l.vencimento)))) })
              else if (confirm('Excluir este lançamento?')) update(d => { d.lancamentos = d.lancamentos.filter(x => x.id !== l.id) })
            }}>Excluir</button>
          </td>
        </tr>
      ))}</tbody>
    </table></div>}
    {novo && <NovoLancamento tipoInicial={tipo} onFechar={() => setNovo(false)} />}
  </>
}

function NovoLancamento({ tipoInicial, onFechar }: { tipoInicial: Lancamento['tipo']; onFechar: () => void }) {
  const db = useDB(d => d)
  const [l, setL] = useState<Omit<Lancamento, 'id' | 'parcela' | 'grupo'>>({ tipo: tipoInicial, descricao: '', valor: 0, vencimento: hoje(), competencia: hoje().slice(0, 7), status: 'pendente', contaBancariaId: db.contasBancarias[0]?.id ?? '', conciliado: false })
  const [modo, setModo] = useState<'unico' | 'parcelado' | 'recorrente'>('unico')
  const [n, setN] = useState(2)
  const [pessoaRapida, setPessoaRapida] = useState({ nome: '', telefone: '', email: '' })
  const set = (p: Partial<typeof l>) => setL({ ...l, ...p })
  const duplicada = pessoaRapida.nome && db.pessoas.find(p => (pessoaRapida.telefone && p.telefone === pessoaRapida.telefone) || (pessoaRapida.email && p.email === pessoaRapida.email))
  const planos = db.planoContas.filter(p => l.tipo === 'receber' ? p.tipo === 'receita' : p.tipo === 'despesa')
  return (
    <Modal aberto onFechar={onFechar} titulo="Novo lançamento" largura="max-w-3xl">
      <form className="grid gap-4 sm:grid-cols-3" onSubmit={e => {
        e.preventDefault()
        let pessoaId = l.pessoaId
        if (!pessoaId && pessoaRapida.nome) {
          if (duplicada) pessoaId = duplicada.id
          else { pessoaId = uid(); update(d => { d.pessoas.unshift({ id: pessoaId!, ...pessoaRapida, documento: '', tipos: [l.tipo === 'pagar' ? 'fornecedor' : 'cliente'], criadoEm: hoje() }) }) }
        }
        criarLancamentos({ ...l, pessoaId, quitadoEm: l.status === 'quitado' ? l.vencimento : undefined }, n, modo, addMeses)
        notificar('Lançamento criado'); onFechar()
      }}>
        <Campo label="Tipo"><select className="input" value={l.tipo} onChange={e => set({ tipo: e.target.value as Lancamento['tipo'], planoContaId: undefined })}><option value="receber">A receber</option><option value="pagar">A pagar</option><option value="transferencia">Transferência</option></select></Campo>
        <Campo label="Descrição" className="sm:col-span-2"><input required className="input" value={l.descricao} onChange={e => set({ descricao: e.target.value })} /></Campo>
        <Campo label="Valor (R$)"><input required type="number" step="0.01" min="0.01" className="input" value={l.valor || ''} onChange={e => set({ valor: Number(e.target.value) })} /></Campo>
        <Campo label="Vencimento (1ª)"><input type="date" className="input" value={l.vencimento} onChange={e => set({ vencimento: e.target.value })} /></Campo>
        <Campo label="Situação"><select className="input" value={l.status} onChange={e => set({ status: e.target.value as Lancamento['status'] })}><option value="pendente">Pendente</option><option value="quitado">Já quitado</option></select></Campo>
        <Campo label={l.tipo === 'transferencia' ? 'Conta de origem' : 'Conta bancária'}><select className="input" value={l.contaBancariaId} onChange={e => set({ contaBancariaId: e.target.value })}>{db.contasBancarias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
        {l.tipo === 'transferencia' ? <Campo label="Conta de destino"><select required className="input" value={l.contaDestinoId ?? ''} onChange={e => set({ contaDestinoId: e.target.value })}><option value="">Selecione…</option>{db.contasBancarias.filter(c => c.id !== l.contaBancariaId).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo> : <>
          <Campo label="Plano de contas"><select required className="input" value={l.planoContaId ?? ''} onChange={e => set({ planoContaId: e.target.value })}><option value="">Selecione…</option>{planos.map(p => <option key={p.id} value={p.id}>{p.codigo} {p.nome}</option>)}</select></Campo>
          <Campo label="Centro de custo"><select className="input" value={l.centroCustoId ?? ''} onChange={e => set({ centroCustoId: e.target.value || undefined })}><option value="">—</option>{db.centrosCusto.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
        </>}
        {l.tipo !== 'transferencia' && <div className="rounded-xl bg-neutral-50 p-4 sm:col-span-3">
          <Campo label={l.tipo === 'pagar' ? 'Fornecedor' : 'Cliente'}><select className="input" value={l.pessoaId ?? ''} onChange={e => set({ pessoaId: e.target.value || undefined })}><option value="">+ Cadastro rápido / nenhum</option>{db.pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
          {!l.pessoaId && <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input className="input" placeholder="Nome" value={pessoaRapida.nome} onChange={e => setPessoaRapida({ ...pessoaRapida, nome: e.target.value })} />
            <input className="input" placeholder="Telefone" value={pessoaRapida.telefone} onChange={e => setPessoaRapida({ ...pessoaRapida, telefone: e.target.value })} />
            <input className="input" placeholder="E-mail" value={pessoaRapida.email} onChange={e => setPessoaRapida({ ...pessoaRapida, email: e.target.value })} />
            {duplicada && <p className="text-xs font-semibold text-amber-700 sm:col-span-3">Já existe “{duplicada.nome}” com esse telefone/e-mail. O lançamento será vinculado a ele.</p>}
          </div>}
        </div>}
        <div className="sm:col-span-3">
          <div className="label">Repetição</div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {(['unico', 'parcelado', 'recorrente'] as const).map(m => <label key={m} className="flex items-center gap-2"><input type="radio" className="accent-ink" checked={modo === m} onChange={() => setModo(m)} />{m === 'unico' ? 'Único' : m === 'parcelado' ? 'Parcelado (divide o valor)' : 'Recorrente mensal (repete o valor)'}</label>)}
            {modo !== 'unico' && <label className="flex items-center gap-2">Ocorrências <input type="number" min={2} max={99} className="input w-20" value={n} onChange={e => setN(Number(e.target.value))} /></label>}
          </div>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-3"><button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary">Salvar</button></div>
      </form>
    </Modal>
  )
}

/* ---------------- Conciliação bancária (OFX) ---------------- */
interface TransacaoOFX { id: string; data: string; valor: number; memo: string }
export function parseOFX(txt: string): TransacaoOFX[] {
  const blocos = txt.split(/<STMTTRN>/i).slice(1)
  return blocos.map((b, i) => {
    const tag = (t: string) => (b.match(new RegExp(`<${t}>([^<\\r\\n]*)`, 'i'))?.[1] ?? '').trim()
    const d = tag('DTPOSTED')
    return { id: tag('FITID') || String(i), data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, valor: Number(tag('TRNAMT').replace(',', '.')), memo: tag('MEMO') || tag('NAME') }
  }).filter(t => !Number.isNaN(t.valor) && t.data.length === 10)
}

export function Conciliacao() {
  const db = useDB(d => d)
  const [conta, setConta] = useState(db.contasBancarias[0]?.id ?? '')
  const [extrato, setExtrato] = useState<TransacaoOFX[]>([])
  const [feitos, setFeitos] = useState<Record<string, string>>({})
  const candidatos = (t: TransacaoOFX) => db.lancamentos.filter(l => !l.conciliado && l.contaBancariaId === conta && l.tipo !== 'transferencia' && Math.abs(l.valor - Math.abs(t.valor)) < 0.01 && (t.valor > 0 ? l.tipo === 'receber' : l.tipo === 'pagar') && Math.abs(diffDias(l.quitadoEm ?? l.vencimento, t.data)) <= 5)
  const conciliar = (t: TransacaoOFX, lancId: string) => { update(d => { const l = d.lancamentos.find(l => l.id === lancId)!; l.conciliado = true; l.status = 'quitado'; l.quitadoEm = l.quitadoEm ?? t.data }); setFeitos({ ...feitos, [t.id]: lancId }) }
  const criarDe = (t: TransacaoOFX) => {
    const id = uid()
    update(d => { d.lancamentos.unshift({ id, tipo: t.valor > 0 ? 'receber' : 'pagar', descricao: t.memo || 'Lançamento do extrato', valor: Math.abs(t.valor), vencimento: t.data, competencia: t.data.slice(0, 7), status: 'quitado', quitadoEm: t.data, contaBancariaId: conta, planoContaId: d.planoContas.find(p => p.tipo === (t.valor > 0 ? 'receita' : 'despesa'))?.id, conciliado: true, origem: 'extrato' }) })
    setFeitos({ ...feitos, [t.id]: id })
  }
  const exemplo = () => {
    const ls = db.lancamentos.filter(l => l.contaBancariaId === conta && l.status === 'quitado' && l.tipo !== 'transferencia').slice(0, 3)
    const trn = [...ls.map(l => ({ d: (l.quitadoEm ?? l.vencimento).replace(/-/g, ''), v: (l.tipo === 'pagar' ? -l.valor : l.valor).toFixed(2), m: l.descricao })), { d: hoje().replace(/-/g, ''), v: '-39.90', m: 'TARIFA BANCARIA' }]
    const ofx = `OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n${trn.map((t, i) => `<STMTTRN><TRNTYPE>OTHER<DTPOSTED>${t.d}<TRNAMT>${t.v}<FITID>EX${i}<MEMO>${t.m}</STMTTRN>`).join('\n')}\n</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
    setExtrato(parseOFX(ofx)); setFeitos({})
  }
  const conciliadoSaldo = db.lancamentos.filter(l => l.conciliado && (l.contaBancariaId === conta)).reduce((s, l) => s + (l.tipo === 'pagar' ? -l.valor : l.valor), db.contasBancarias.find(c => c.id === conta)?.saldoInicial ?? 0)
  return <>
    <PageHeader titulo="Conciliação bancária" sub="Importe o extrato OFX do banco e confira com os lançamentos" acoes={<>
      <select className="input w-auto" value={conta} onChange={e => { setConta(e.target.value); setExtrato([]) }}>{db.contasBancarias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
      <label className="btn-primary cursor-pointer">Importar OFX<input type="file" accept=".ofx,.txt" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) { setExtrato(parseOFX(await f.text())); setFeitos({}) } }} /></label>
      <button className="btn-ghost" onClick={exemplo}>Usar extrato de exemplo</button>
    </>} />
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <Kpi destaque titulo="Saldo no sistema" valor={brl(saldoConta(db, conta))} />
      <Kpi titulo="Saldo conciliado" valor={brl(conciliadoSaldo)} />
      <Kpi titulo="Itens do extrato" valor={`${Object.keys(feitos).length}/${extrato.length}`} detalhe="conciliados" />
    </div>
    {extrato.length === 0 ? <Vazio texto="Importe um arquivo OFX ou use o extrato de exemplo." /> : <div className="card overflow-x-auto p-0"><table className="table">
      <thead><tr><th>Data</th><th>Extrato</th><th className="text-right">Valor</th><th>Lançamento no sistema</th></tr></thead>
      <tbody>{extrato.map(t => {
        const c = candidatos(t)
        const feito = feitos[t.id] ? db.lancamentos.find(l => l.id === feitos[t.id]) : undefined
        return <tr key={t.id}>
          <td>{dataBR(t.data)}</td><td>{t.memo}</td><td className={`text-right font-semibold ${t.valor < 0 ? 'text-red-700' : ''}`}>{brl(t.valor)}</td>
          <td>{feito ? <Badge cor="verde">✓ {feito.descricao}</Badge> : c.length ? <div className="flex flex-wrap gap-2">{c.map(l => <button key={l.id} className="btn-primary px-3 py-1" onClick={() => conciliar(t, l.id)}>Conciliar com “{l.descricao}” ({dataBR(l.quitadoEm ?? l.vencimento)})</button>)}</div>
            : <div className="flex items-center gap-2"><Badge cor="vermelho">sem correspondência</Badge><button className="text-sm font-semibold underline" onClick={() => criarDe(t)}>Criar lançamento</button></div>}</td>
        </tr>
      })}</tbody>
    </table></div>}
  </>
}

/* ---------------- DRE gerencial ---------------- */
export function DRE() {
  const db = useDB(d => d)
  const [ano, setAno] = useState(Number(hoje().slice(0, 4)))
  const [regime, setRegime] = useState<'caixa' | 'competencia'>('competencia')
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`)
  const dados = useMemo(() => {
    const val: Record<string, Record<string, number>> = {}
    for (const l of db.lancamentos) {
      if (l.tipo === 'transferencia' || !l.planoContaId) continue
      const ref = regime === 'caixa' ? (l.status === 'quitado' ? l.quitadoEm?.slice(0, 7) : undefined) : l.competencia
      if (!ref || !ref.startsWith(String(ano))) continue
      val[l.planoContaId] ??= {}
      val[l.planoContaId][ref] = (val[l.planoContaId][ref] ?? 0) + l.valor
    }
    return val
  }, [db.lancamentos, ano, regime])
  const soma = (tipo: 'receita' | 'despesa', m: string) => db.planoContas.filter(p => p.tipo === tipo).reduce((s, p) => s + (dados[p.id]?.[m] ?? 0), 0)
  const linha = (p: { id: string; codigo: string; nome: string }) => <tr key={p.id}><td className="whitespace-nowrap">{p.codigo} {p.nome}</td>{meses.map(m => <td key={m} className="text-right tabular-nums">{dados[p.id]?.[m] ? brl(dados[p.id][m]) : '—'}</td>)}<td className="text-right font-semibold">{brl(meses.reduce((s, m) => s + (dados[p.id]?.[m] ?? 0), 0))}</td></tr>
  const total = (tipo: 'receita' | 'despesa') => meses.reduce((s, m) => s + soma(tipo, m), 0)
  return <>
    <PageHeader titulo="DRE gerencial" sub="Resultado mês a mês pelo plano de contas" acoes={<>
      <select className="input w-auto" value={ano} onChange={e => setAno(Number(e.target.value))}>{[0, 1, 2].map(n => { const a = Number(hoje().slice(0, 4)) - n; return <option key={a}>{a}</option> })}</select>
      <select className="input w-auto" value={regime} onChange={e => setRegime(e.target.value as 'caixa' | 'competencia')}><option value="competencia">Regime de competência</option><option value="caixa">Regime de caixa</option></select>
    </>} />
    <div className="mb-6 grid gap-4 sm:grid-cols-3"><Kpi titulo="Receitas" valor={brl(total('receita'))} /><Kpi titulo="Despesas" valor={brl(total('despesa'))} /><Kpi destaque titulo="Resultado" valor={brl(total('receita') - total('despesa'))} /></div>
    <div className="card overflow-x-auto p-0"><table className="table text-xs">
      <thead><tr><th>Conta</th>{meses.map(m => <th key={m} className="text-right">{competenciaBR(m)}</th>)}<th className="text-right">Total</th></tr></thead>
      <tbody>
        <tr className="bg-brand-light font-black"><td>(+) Receitas</td>{meses.map(m => <td key={m} className="text-right">{brl(soma('receita', m))}</td>)}<td className="text-right">{brl(total('receita'))}</td></tr>
        {db.planoContas.filter(p => p.tipo === 'receita').map(linha)}
        <tr className="bg-neutral-100 font-black"><td>(−) Despesas</td>{meses.map(m => <td key={m} className="text-right">{brl(soma('despesa', m))}</td>)}<td className="text-right">{brl(total('despesa'))}</td></tr>
        {db.planoContas.filter(p => p.tipo === 'despesa').map(linha)}
        <tr className="bg-ink font-black text-white"><td>(=) Resultado</td>{meses.map(m => { const r = soma('receita', m) - soma('despesa', m); return <td key={m} className={`text-right ${r < 0 ? 'text-red-300' : 'text-brand'}`}>{brl(r)}</td> })}<td className="text-right text-brand">{brl(total('receita') - total('despesa'))}</td></tr>
      </tbody>
    </table></div>
  </>
}

/* ---------------- Cadastros financeiros ---------------- */
export function CadastrosFinanceiros() {
  const db = useDB(d => d)
  const [aba, setAba] = useState<'plano' | 'centros' | 'contas'>('plano')
  return <>
    <PageHeader titulo="Cadastros financeiros" sub="Plano de contas, centros de custo e contas bancárias" />
    <Tabs abas={[{ id: 'plano', nome: 'Plano de contas' }, { id: 'centros', nome: 'Centros de custo' }, { id: 'contas', nome: 'Contas bancárias' }]} ativa={aba} onChange={setAba} />
    {aba === 'plano' && <div className="card space-y-2">
      {[...db.planoContas].sort((a, b) => a.codigo.localeCompare(b.codigo)).map(p => <div key={p.id} className="grid gap-2 sm:grid-cols-[100px_1fr_140px_auto]">
        <input className="input" value={p.codigo} onChange={e => update(d => { d.planoContas.find(x => x.id === p.id)!.codigo = e.target.value })} />
        <input className="input" value={p.nome} onChange={e => update(d => { d.planoContas.find(x => x.id === p.id)!.nome = e.target.value })} />
        <select className="input" value={p.tipo} onChange={e => update(d => { d.planoContas.find(x => x.id === p.id)!.tipo = e.target.value as 'receita' | 'despesa' })}><option value="receita">Receita</option><option value="despesa">Despesa</option></select>
        <button className="btn-danger" disabled={db.lancamentos.some(l => l.planoContaId === p.id)} title="Contas com lançamentos não podem ser removidas" onClick={() => update(d => { d.planoContas = d.planoContas.filter(x => x.id !== p.id) })}>×</button>
      </div>)}
      <button className="btn-ghost" onClick={() => update(d => { d.planoContas.push({ id: uid(), codigo: '9.99', nome: 'Nova conta', tipo: 'despesa' }) })}>+ Conta</button>
    </div>}
    {aba === 'centros' && <div className="card space-y-2">
      {db.centrosCusto.map(c => <div key={c.id} className="flex gap-2"><input className="input" value={c.nome} onChange={e => update(d => { d.centrosCusto.find(x => x.id === c.id)!.nome = e.target.value })} /><button className="btn-danger" onClick={() => update(d => { d.centrosCusto = d.centrosCusto.filter(x => x.id !== c.id) })}>×</button></div>)}
      <button className="btn-ghost" onClick={() => update(d => { d.centrosCusto.push({ id: uid(), nome: 'Novo centro' }) })}>+ Centro de custo</button>
    </div>}
    {aba === 'contas' && <div className="card space-y-2">
      {db.contasBancarias.map(c => <div key={c.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_160px_auto]">
        <input className="input" value={c.nome} onChange={e => update(d => { d.contasBancarias.find(x => x.id === c.id)!.nome = e.target.value })} />
        <input className="input" value={c.banco} onChange={e => update(d => { d.contasBancarias.find(x => x.id === c.id)!.banco = e.target.value })} />
        <input type="number" className="input" value={c.saldoInicial} onChange={e => update(d => { d.contasBancarias.find(x => x.id === c.id)!.saldoInicial = Number(e.target.value) })} title="Saldo inicial" />
        <button className="btn-danger" disabled={db.lancamentos.some(l => l.contaBancariaId === c.id)} onClick={() => update(d => { d.contasBancarias = d.contasBancarias.filter(x => x.id !== c.id) })}>×</button>
      </div>)}
      <button className="btn-ghost" onClick={() => update(d => { d.contasBancarias.push({ id: uid(), nome: 'Nova conta', banco: '', saldoInicial: 0 }) })}>+ Conta bancária</button>
    </div>}
  </>
}
