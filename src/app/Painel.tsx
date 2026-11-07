import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Barra, Campo, Kpi, Modal, PageHeader, Vazio } from '../components/ui'
import { getDB, salvarItem, update, useDB } from '../lib/store'
import { brl, dataBR, diffDias, hoje, uid } from '../lib/format'
import type { Atividade, TipoAtividade } from '../lib/types'

export const nomeTipoAtividade: Record<TipoAtividade, string> = { ligacao: 'Ligação', visita: 'Visita', tarefa: 'Tarefa', email: 'E-mail', whatsapp: 'WhatsApp', reuniao: 'Reunião' }

export function Dashboard() {
  const db = useDB(d => d)
  const abertas = db.oportunidades.filter(o => o.status === 'aberta')
  const ganhas = db.oportunidades.filter(o => o.status === 'ganha')
  const fechadas = db.oportunidades.filter(o => o.status !== 'aberta')
  const conversao = fechadas.length ? (ganhas.length / fechadas.length) * 100 : 0
  const leadsMes = db.oportunidades.filter(o => o.criadoEm.slice(0, 7) === hoje().slice(0, 7)).length
  const parados = abertas.filter(o => diffDias(hoje(), o.atualizadoEm) > 7)
  const atrasadas = db.atividades.filter(a => !a.concluida && a.prazo < hoje())
  const faturasAbertas = db.faturas.filter(f => f.status === 'aberta')
  const inadimplentes = faturasAbertas.filter(f => f.vencimento < hoje())
  const porOrigem = Object.entries(db.oportunidades.reduce<Record<string, number>>((acc, o) => { acc[o.origem] = (acc[o.origem] ?? 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1])
  const ranking = db.usuarios.filter(u => u.papel !== 'financeiro').map(u => ({
    u, ganhas: ganhas.filter(o => o.corretorId === u.id), abertas: abertas.filter(o => o.corretorId === u.id).length,
  })).sort((a, b) => b.ganhas.reduce((s, o) => s + o.valor, 0) - a.ganhas.reduce((s, o) => s + o.valor, 0))
  const funil = db.funis[0]

  return (
    <>
      <PageHeader titulo="Painel" sub={`Visão geral da imobiliária em ${dataBR(hoje())}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi destaque titulo="Oportunidades abertas" valor={abertas.length} detalhe={brl(abertas.reduce((s, o) => s + o.valor, 0)) + ' em negociação'} />
        <Kpi titulo="Leads no mês" valor={leadsMes} detalhe={`${parados.length} oportunidades paradas há +7 dias`} />
        <Kpi titulo="Conversão" valor={`${conversao.toFixed(0)}%`} detalhe={`${ganhas.length} ganhas de ${fechadas.length} encerradas`} />
        <Kpi titulo="Contratos ativos" valor={db.contratos.filter(c => c.status === 'ativo').length} detalhe={`${inadimplentes.length} faturas vencidas`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-black">Funil · {funil?.nome}</h2>
          <div className="space-y-2">
            {funil?.etapas.map(e => { const n = abertas.filter(o => o.etapaId === e.id).length; return <Barra key={e.id} rotulo={e.nome} valor={n} max={Math.max(1, ...funil.etapas.map(x => abertas.filter(o => o.etapaId === x.id).length))} /> })}
          </div>
        </div>
        <div className="card">
          <h2 className="mb-4 font-black">Leads por origem</h2>
          <div className="space-y-2">{porOrigem.map(([o, n]) => <Barra key={o} rotulo={o} valor={n} max={porOrigem[0][1]} />)}</div>
        </div>
        <div className="card">
          <h2 className="mb-4 font-black">Ranking de corretores</h2>
          <table className="table">
            <thead><tr><th>#</th><th>Corretor</th><th>Abertas</th><th>Ganhas</th><th className="text-right">Volume</th></tr></thead>
            <tbody>{ranking.map((r, i) => <tr key={r.u.id}><td className="font-black">{i + 1}º</td><td>{r.u.nome}</td><td>{r.abertas}</td><td>{r.ganhas.length}</td><td className="text-right">{brl(r.ganhas.reduce((s, o) => s + o.valor, 0))}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="card">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-black">Precisa de atenção</h2><Link to="/app/agenda" className="text-sm font-semibold underline">Agenda</Link></div>
          <ul className="space-y-2 text-sm">
            {atrasadas.map(a => <li key={a.id} className="flex justify-between gap-2"><span>⚠ {nomeTipoAtividade[a.tipo]}: {a.descricao}</span><Badge cor="vermelho">venceu {dataBR(a.prazo)}</Badge></li>)}
            {parados.map(o => <li key={o.id} className="flex justify-between gap-2"><Link className="hover:underline" to={`/app/oportunidade/${o.id}`}>⏸ {o.titulo}</Link><Badge cor="amarelo">parada</Badge></li>)}
            {inadimplentes.map(f => <li key={f.id} className="flex justify-between gap-2"><span>💸 Fatura {db.contratos.find(c => c.id === f.contratoId)?.codigo} · {brl(f.valor)}</span><Badge cor="vermelho">vencida</Badge></li>)}
            {!atrasadas.length && !parados.length && !inadimplentes.length && <li className="text-ink-muted">Tudo em dia. 🎉</li>}
          </ul>
        </div>
      </div>
    </>
  )
}

export function Agenda() {
  const db = useDB(d => d)
  const [filtro, setFiltro] = useState<'hoje' | 'atrasadas' | 'proximas' | 'concluidas' | 'todas'>('hoje')
  const [edit, setEdit] = useState<Atividade | null>(null)
  const lista = db.atividades.filter(a => {
    if (filtro === 'hoje') return !a.concluida && a.prazo === hoje()
    if (filtro === 'atrasadas') return !a.concluida && a.prazo < hoje()
    if (filtro === 'proximas') return !a.concluida && a.prazo > hoje()
    if (filtro === 'concluidas') return a.concluida
    return true
  }).sort((a, b) => a.prazo.localeCompare(b.prazo))
  const novo = (): Atividade => ({ id: uid(), tipo: 'tarefa', descricao: '', prazo: hoje(), responsavelId: getDB().usuarios[0]?.id, concluida: false })
  return (
    <>
      <PageHeader titulo="Agenda e atividades" sub="Ligações, visitas, tarefas e retornos da equipe" acoes={<button className="btn-primary" onClick={() => setEdit(novo())}>+ Nova atividade</button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['hoje', 'atrasadas', 'proximas', 'concluidas', 'todas'] as const).map(f => <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${filtro === f ? 'bg-ink text-brand' : 'bg-white border border-neutral-300'}`}>{f === 'proximas' ? 'próximas' : f === 'concluidas' ? 'concluídas' : f}</button>)}
      </div>
      {lista.length === 0 ? <Vazio texto="Nenhuma atividade neste filtro." /> : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th></th><th>Tipo</th><th>Descrição</th><th>Oportunidade</th><th>Responsável</th><th>Prazo</th><th></th></tr></thead>
            <tbody>{lista.map(a => {
              const op = db.oportunidades.find(o => o.id === a.oportunidadeId)
              return (
                <tr key={a.id} className={a.concluida ? 'opacity-50' : ''}>
                  <td><input type="checkbox" className="h-4 w-4 accent-ink" checked={a.concluida} onChange={() => update(d => { const x = d.atividades.find(x => x.id === a.id)!; x.concluida = !x.concluida })} /></td>
                  <td><Badge cor="amarelo">{nomeTipoAtividade[a.tipo]}</Badge></td>
                  <td className={a.concluida ? 'line-through' : ''}>{a.descricao}</td>
                  <td>{op ? <Link className="hover:underline" to={`/app/oportunidade/${op.id}`}>{op.titulo}</Link> : '—'}</td>
                  <td>{db.usuarios.find(u => u.id === a.responsavelId)?.nome ?? '—'}</td>
                  <td>{!a.concluida && a.prazo < hoje() ? <Badge cor="vermelho">{dataBR(a.prazo)}</Badge> : dataBR(a.prazo)}</td>
                  <td><button className="text-sm font-semibold underline" onClick={() => setEdit(a)}>Editar</button></td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
      <AtividadeModal atividade={edit} onFechar={() => setEdit(null)} />
    </>
  )
}

export function AtividadeModal({ atividade, onFechar }: { atividade: Atividade | null; onFechar: () => void }) {
  const db = useDB(d => d)
  const [form, setForm] = useState<Atividade | null>(atividade)
  if (atividade && form?.id !== atividade.id) setForm(atividade)
  if (!atividade || !form) return null
  const set = (p: Partial<Atividade>) => setForm({ ...form, ...p })
  return (
    <Modal aberto onFechar={onFechar} titulo={db.atividades.some(a => a.id === form.id) ? 'Editar atividade' : 'Nova atividade'}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); salvarItem('atividades', form); onFechar() }}>
        <Campo label="Tipo"><select className="input" value={form.tipo} onChange={e => set({ tipo: e.target.value as TipoAtividade })}>{Object.entries(nomeTipoAtividade).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        <Campo label="Prazo"><input type="date" className="input" value={form.prazo} onChange={e => set({ prazo: e.target.value })} required /></Campo>
        <Campo label="Descrição" className="sm:col-span-2"><input className="input" value={form.descricao} onChange={e => set({ descricao: e.target.value })} required /></Campo>
        <Campo label="Responsável"><select className="input" value={form.responsavelId ?? ''} onChange={e => set({ responsavelId: e.target.value })}>{db.usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></Campo>
        <Campo label="Oportunidade"><select className="input" value={form.oportunidadeId ?? ''} onChange={e => set({ oportunidadeId: e.target.value || undefined })}><option value="">—</option>{db.oportunidades.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}</select></Campo>
        <div className="flex justify-end gap-2 sm:col-span-2">
          {db.atividades.some(a => a.id === form.id) && <button type="button" className="btn-danger mr-auto" onClick={() => { update(d => { d.atividades = d.atividades.filter(a => a.id !== form.id) }); onFechar() }}>Excluir</button>}
          <button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}
