import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Campo, Modal, PageHeader, Tabs, Vazio, notificar } from '../components/ui'
import { capturarLead, salvarItem, update, useDB } from '../lib/store'
import { agoraISO, brl, dataBR, dataHoraBR, diffDias, hoje, uid } from '../lib/format'
import type { Atividade, Oportunidade, Pessoa, Proposta, StatusProposta, TipoPessoa } from '../lib/types'
import { AtividadeModal, nomeTipoAtividade } from './Painel'
import { useSlug } from './AppLayout'

const origens = ['Site', 'Portal A', 'Portal B', 'WhatsApp', 'Indicação', 'Redes sociais', 'Placa', 'Telefone']

/* ---------------- Funil (kanban) ---------------- */
export function Funil() {
  const db = useDB(d => d)
  const [funilId, setFunilId] = useState(db.funis[0]?.id)
  const [corretor, setCorretor] = useState('')
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [editFunil, setEditFunil] = useState(false)
  const funil = db.funis.find(f => f.id === funilId) ?? db.funis[0]
  if (!funil) return <Vazio texto="Nenhum funil cadastrado." />
  const ops = db.oportunidades.filter(o => o.funilId === funil.id && o.status === 'aberta' && (!corretor || o.corretorId === corretor))
  const mover = (opId: string, etapaId: string) => update(d => {
    const o = d.oportunidades.find(o => o.id === opId)!
    if (o.etapaId === etapaId) return
    const nome = funil.etapas.find(e => e.id === etapaId)?.nome
    o.etapaId = etapaId; o.atualizadoEm = hoje(); o.historico.unshift({ em: agoraISO(), texto: `Movida para a etapa "${nome}"` })
  })
  return (
    <>
      <PageHeader titulo="Funil de vendas" sub="Arraste os cartões entre as etapas" acoes={<>
        <select className="input w-auto" value={funil.id} onChange={e => setFunilId(e.target.value)}>{db.funis.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select>
        <select className="input w-auto" value={corretor} onChange={e => setCorretor(e.target.value)}><option value="">Todos os corretores</option>{db.usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>
        <button className="btn-ghost" onClick={() => setEditFunil(true)}>Personalizar funis</button>
        <button className="btn-primary" onClick={() => setNovo(true)}>+ Oportunidade</button>
      </>} />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {funil.etapas.map(e => {
          const lista = ops.filter(o => o.etapaId === e.id)
          return (
            <div key={e.id} className={`w-72 shrink-0 rounded-xl p-3 transition ${arrastando ? 'bg-brand-light' : 'bg-neutral-100'}`}
              onDragOver={ev => ev.preventDefault()} onDrop={() => { if (arrastando) mover(arrastando, e.id); setArrastando(null) }}>
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-sm font-black">{e.nome}</span>
                <span className="text-xs font-semibold text-ink-muted">{lista.length} · {brl(lista.reduce((s, o) => s + o.valor, 0))}</span>
              </div>
              <div className="space-y-2">
                {lista.map(o => {
                  const parado = diffDias(hoje(), o.atualizadoEm)
                  const pendente = db.atividades.find(a => a.oportunidadeId === o.id && !a.concluida)
                  return (
                    <Link key={o.id} to={`/app/oportunidade/${o.id}`} draggable onDragStart={() => setArrastando(o.id)} onDragEnd={() => setArrastando(null)}
                      className="block cursor-grab rounded-lg border border-neutral-200 bg-white p-3 shadow-sm hover:border-ink active:cursor-grabbing">
                      <div className="text-sm font-bold">{o.titulo}</div>
                      <div className="mt-1 text-xs text-ink-muted">{db.pessoas.find(p => p.id === o.pessoaId)?.nome} · {o.origem}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <Badge cor="preto">{brl(o.valor)}</Badge>
                        {parado > 7 ? <Badge cor="vermelho">parada {parado}d</Badge> : parado > 3 ? <Badge cor="amarelo">atenção</Badge> : <Badge cor="verde">em andamento</Badge>}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                        <span>{db.usuarios.find(u => u.id === o.corretorId)?.nome ?? 'Sem corretor'}</span>
                        {pendente && <span>⏰ {dataBR(pendente.prazo)}</span>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <NovaOportunidade aberto={novo} onFechar={() => setNovo(false)} funilId={funil.id} />
      <EditarFunis aberto={editFunil} onFechar={() => setEditFunil(false)} />
    </>
  )
}

function NovaOportunidade({ aberto, onFechar, funilId }: { aberto: boolean; onFechar: () => void; funilId: string }) {
  const db = useDB(d => d)
  const nav = useNavigate()
  const [pessoaId, setPessoaId] = useState('')
  const [novaPessoa, setNovaPessoa] = useState({ nome: '', telefone: '', email: '' })
  const [titulo, setTitulo] = useState('')
  const [imovelId, setImovelId] = useState('')
  const [origem, setOrigem] = useState('Site')
  const [corretorId, setCorretorId] = useState(db.usuarios[1]?.id ?? '')
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Nova oportunidade">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => {
        e.preventDefault()
        const funil = db.funis.find(f => f.id === funilId)!
        const imovel = db.imoveis.find(i => i.id === imovelId)
        let pid = pessoaId
        const id = uid()
        update(d => {
          if (!pid) { pid = uid(); d.pessoas.unshift({ id: pid, ...novaPessoa, documento: '', tipos: ['cliente'], criadoEm: hoje() }) }
          const nomeP = d.pessoas.find(p => p.id === pid)?.nome ?? ''
          d.oportunidades.unshift({ id, titulo: titulo || `${nomeP}${imovel ? ' — ' + imovel.codigo : ''}`, pessoaId: pid, funilId, etapaId: funil.etapas[0].id, corretorId, imovelId: imovel?.id, origem, valor: imovel?.preco ?? 0, status: 'aberta', criadoEm: hoje(), atualizadoEm: hoje(), perfil: imovel ? { finalidade: imovel.finalidade, tipo: imovel.tipo, bairro: imovel.bairro, precoMax: imovel.preco * 1.15 } : {}, historico: [{ em: agoraISO(), texto: `Oportunidade criada manualmente (origem: ${origem})` }] })
        })
        onFechar(); nav(`/app/oportunidade/${id}`)
      }}>
        <Campo label="Cliente existente" className="sm:col-span-2"><select className="input" value={pessoaId} onChange={e => setPessoaId(e.target.value)}><option value="">+ Cadastrar novo cliente</option>{db.pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
        {!pessoaId && <>
          <Campo label="Nome"><input required className="input" value={novaPessoa.nome} onChange={e => setNovaPessoa({ ...novaPessoa, nome: e.target.value })} /></Campo>
          <Campo label="Telefone"><input className="input" value={novaPessoa.telefone} onChange={e => setNovaPessoa({ ...novaPessoa, telefone: e.target.value })} /></Campo>
          <Campo label="E-mail" className="sm:col-span-2"><input type="email" className="input" value={novaPessoa.email} onChange={e => setNovaPessoa({ ...novaPessoa, email: e.target.value })} /></Campo>
        </>}
        <Campo label="Título (opcional)" className="sm:col-span-2"><input className="input" value={titulo} onChange={e => setTitulo(e.target.value)} /></Campo>
        <Campo label="Imóvel de interesse"><select className="input" value={imovelId} onChange={e => setImovelId(e.target.value)}><option value="">—</option>{db.imoveis.map(i => <option key={i.id} value={i.id}>{i.codigo} · {i.titulo}</option>)}</select></Campo>
        <Campo label="Origem"><select className="input" value={origem} onChange={e => setOrigem(e.target.value)}>{origens.map(o => <option key={o}>{o}</option>)}</select></Campo>
        <Campo label="Corretor"><select className="input" value={corretorId} onChange={e => setCorretorId(e.target.value)}>{db.usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></Campo>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary">Criar</button></div>
      </form>
    </Modal>
  )
}

function EditarFunis({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const funis = useDB(d => d.funis)
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Personalizar funis" largura="max-w-3xl">
      <div className="space-y-6">
        {funis.map(f => (
          <div key={f.id} className="rounded-xl border border-neutral-200 p-4">
            <input className="input mb-3 font-bold" value={f.nome} onChange={e => update(d => { d.funis.find(x => x.id === f.id)!.nome = e.target.value })} />
            <div className="space-y-2">
              {f.etapas.map((et, i) => (
                <div key={et.id} className="flex gap-2">
                  <input className="input" value={et.nome} onChange={e => update(d => { d.funis.find(x => x.id === f.id)!.etapas[i].nome = e.target.value })} />
                  <button className="btn-ghost" disabled={i === 0} onClick={() => update(d => { const e = d.funis.find(x => x.id === f.id)!.etapas;[e[i - 1], e[i]] = [e[i], e[i - 1]] })}>↑</button>
                  <button className="btn-danger" disabled={f.etapas.length <= 1} onClick={() => update(d => {
                    const fx = d.funis.find(x => x.id === f.id)!
                    fx.etapas.splice(i, 1)
                    d.oportunidades.filter(o => o.etapaId === et.id).forEach(o => { o.etapaId = fx.etapas[0].id })
                  })}>Remover</button>
                </div>
              ))}
            </div>
            <button className="btn-ghost mt-3" onClick={() => update(d => { d.funis.find(x => x.id === f.id)!.etapas.push({ id: uid(), nome: 'Nova etapa' }) })}>+ Etapa</button>
          </div>
        ))}
        <button className="btn-dark" onClick={() => update(d => { d.funis.push({ id: uid(), nome: 'Novo funil', etapas: [{ id: uid(), nome: 'Novo lead' }, { id: uid(), nome: 'Em atendimento' }] }) })}>+ Novo funil</button>
      </div>
    </Modal>
  )
}

/* ---------------- Detalhe da oportunidade ---------------- */
export function OportunidadeDetalhe() {
  const { id } = useParams()
  const db = useDB(d => d)
  const [atv, setAtv] = useState<Atividade | null>(null)
  const [prop, setProp] = useState<Proposta | null>(null)
  const [nota, setNota] = useState('')
  const slug = useSlug()
  const o = db.oportunidades.find(o => o.id === id)
  if (!o) return <Vazio texto="Oportunidade não encontrada." acao={<Link to="/app/funil" className="btn-primary">Voltar ao funil</Link>} />
  const pessoa = db.pessoas.find(p => p.id === o.pessoaId)
  const funil = db.funis.find(f => f.id === o.funilId)
  const imovel = db.imoveis.find(i => i.id === o.imovelId)
  const set = (fn: (x: Oportunidade) => void) => update(d => { const x = d.oportunidades.find(x => x.id === o.id)!; fn(x); x.atualizadoEm = hoje() })
  const linkVitrine = `${location.origin}/s/${slug}/selecao/${o.id}`
  return (
    <>
      <PageHeader titulo={o.titulo} sub={`${funil?.nome} · criada em ${dataBR(o.criadoEm)} · origem ${o.origem}`} acoes={<>
        {o.status === 'aberta' ? <>
          <button className="btn-primary" onClick={() => { set(x => { x.status = 'ganha'; x.historico.unshift({ em: agoraISO(), texto: 'Negócio ganho 🎉' }) }); notificar('Negócio marcado como ganho!') }}>Marcar como ganho</button>
          <button className="btn-danger" onClick={() => { const m = prompt('Motivo da perda:'); if (m !== null) set(x => { x.status = 'perdida'; x.motivoPerda = m; x.historico.unshift({ em: agoraISO(), texto: `Negócio perdido: ${m}` }) }) }}>Perdido</button>
        </> : <button className="btn-ghost" onClick={() => set(x => { x.status = 'aberta'; x.historico.unshift({ em: agoraISO(), texto: 'Oportunidade reaberta' }) })}>Reabrir</button>}
      </>} />
      {o.status !== 'aberta' && <div className={`mb-4 rounded-xl p-4 font-bold ${o.status === 'ganha' ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>{o.status === 'ganha' ? 'Negócio ganho' : `Negócio perdido${o.motivoPerda ? ': ' + o.motivoPerda : ''}`}</div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <div className="mb-3 text-xs font-bold uppercase text-ink-muted">Etapa</div>
            <div className="flex flex-wrap gap-1">
              {funil?.etapas.map(e => <button key={e.id} onClick={() => set(x => { x.etapaId = e.id; x.historico.unshift({ em: agoraISO(), texto: `Movida para a etapa "${e.nome}"` }) })} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${o.etapaId === e.id ? 'bg-ink text-brand' : 'bg-neutral-100 hover:bg-brand-light'}`}>{e.nome}</button>)}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Campo label="Valor"><input type="number" className="input" value={o.valor} onChange={e => set(x => { x.valor = Number(e.target.value) })} /></Campo>
              <Campo label="Corretor"><select className="input" value={o.corretorId ?? ''} onChange={e => set(x => { x.corretorId = e.target.value })}>{db.usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></Campo>
              <Campo label="Imóvel"><select className="input" value={o.imovelId ?? ''} onChange={e => set(x => { x.imovelId = e.target.value || undefined })}><option value="">—</option>{db.imoveis.map(i => <option key={i.id} value={i.id}>{i.codigo}</option>)}</select></Campo>
            </div>
          </div>
          <div className="card">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-black">Atividades</h2><button className="btn-ghost" onClick={() => setAtv({ id: uid(), oportunidadeId: o.id, tipo: 'ligacao', descricao: '', prazo: hoje(), responsavelId: o.corretorId, concluida: false })}>+ Atividade</button></div>
            <ul className="divide-y divide-neutral-100 text-sm">
              {db.atividades.filter(a => a.oportunidadeId === o.id).map(a => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <input type="checkbox" className="h-4 w-4 accent-ink" checked={a.concluida} onChange={() => update(d => { const x = d.atividades.find(x => x.id === a.id)!; x.concluida = !x.concluida })} />
                  <Badge cor="amarelo">{nomeTipoAtividade[a.tipo]}</Badge>
                  <button className={`flex-1 text-left hover:underline ${a.concluida ? 'line-through opacity-50' : ''}`} onClick={() => setAtv(a)}>{a.descricao}</button>
                  <span className={!a.concluida && a.prazo < hoje() ? 'font-bold text-red-700' : 'text-ink-muted'}>{dataBR(a.prazo)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-black">Propostas</h2><button className="btn-ghost" disabled={!o.imovelId} title={!o.imovelId ? 'Vincule um imóvel primeiro' : ''} onClick={() => setProp({ id: uid(), oportunidadeId: o.id, imovelId: o.imovelId!, valor: o.valor, validade: hoje(), observacoes: '', status: 'em_analise', criadoEm: hoje() })}>+ Proposta</button></div>
            <PropostasTabela lista={db.propostas.filter(p => p.oportunidadeId === o.id)} onEditar={setProp} />
          </div>
          <div className="card">
            <h2 className="mb-3 font-black">Histórico</h2>
            <form className="mb-4 flex gap-2" onSubmit={e => { e.preventDefault(); if (nota.trim()) { set(x => { x.historico.unshift({ em: agoraISO(), texto: nota }) }); setNota('') } }}>
              <input className="input" placeholder="Registrar uma anotação…" value={nota} onChange={e => setNota(e.target.value)} /><button className="btn-dark">Salvar</button>
            </form>
            <ol className="space-y-3 border-l-2 border-brand pl-4 text-sm">{o.historico.map((h, i) => <li key={i}><div className="text-xs text-ink-muted">{dataHoraBR(h.em)}</div>{h.texto}</li>)}</ol>
          </div>
        </div>
        <div className="space-y-6">
          <div className="card">
            <h2 className="mb-3 font-black">Cliente</h2>
            <div className="font-semibold">{pessoa?.nome}</div>
            <div className="text-sm text-ink-muted">{pessoa?.telefone}<br />{pessoa?.email}</div>
            {pessoa?.telefone && <a className="btn-primary mt-3 w-full" target="_blank" rel="noreferrer" href={`https://wa.me/55${pessoa.telefone.replace(/\D/g, '')}`}>Chamar no WhatsApp</a>}
          </div>
          {imovel && <div className="card"><h2 className="mb-3 font-black">Imóvel</h2><img src={imovel.fotos[0]} alt="" className="mb-2 aspect-video w-full rounded-lg object-cover" /><div className="font-semibold">{imovel.codigo} · {imovel.titulo}</div><div className="text-sm text-ink-muted">{imovel.bairro} · {brl(imovel.preco)}</div></div>}
          <div className="card">
            <h2 className="mb-1 font-black">Vitrine do cliente</h2>
            <p className="mb-3 text-xs text-ink-muted">Página com imóveis do perfil abaixo. O pedido de visita entra nesta oportunidade.</p>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Finalidade"><select className="input" value={o.perfil.finalidade ?? ''} onChange={e => set(x => { x.perfil.finalidade = (e.target.value || undefined) as Oportunidade['perfil']['finalidade'] })}><option value="">Todas</option><option value="venda">Venda</option><option value="aluguel">Aluguel</option></select></Campo>
              <Campo label="Quartos mín."><input type="number" className="input" value={o.perfil.quartosMin ?? ''} onChange={e => set(x => { x.perfil.quartosMin = Number(e.target.value) || undefined })} /></Campo>
              <Campo label="Preço máx."><input type="number" className="input" value={o.perfil.precoMax ?? ''} onChange={e => set(x => { x.perfil.precoMax = Number(e.target.value) || undefined })} /></Campo>
              <Campo label="Bairro"><input className="input" value={o.perfil.bairro ?? ''} onChange={e => set(x => { x.perfil.bairro = e.target.value || undefined })} /></Campo>
            </div>
            <div className="mt-3 flex gap-2">
              <a href={linkVitrine} target="_blank" rel="noreferrer" className="btn-dark flex-1">Abrir</a>
              <button className="btn-ghost flex-1" onClick={() => { navigator.clipboard?.writeText(linkVitrine); notificar('Link copiado!') }}>Copiar link</button>
            </div>
          </div>
        </div>
      </div>
      <AtividadeModal atividade={atv} onFechar={() => setAtv(null)} />
      <PropostaModal proposta={prop} onFechar={() => setProp(null)} />
    </>
  )
}

/* ---------------- Propostas ---------------- */
const statusProposta: Record<StatusProposta, [string, string]> = { em_analise: ['Em análise', 'amarelo'], aceita: ['Aceita', 'verde'], recusada: ['Recusada', 'vermelho'], contraproposta: ['Contraproposta', 'azul'] }

function PropostasTabela({ lista, onEditar }: { lista: Proposta[]; onEditar: (p: Proposta) => void }) {
  const db = useDB(d => d)
  if (!lista.length) return <p className="text-sm text-ink-muted">Nenhuma proposta.</p>
  return (
    <div className="overflow-x-auto"><table className="table">
      <thead><tr><th>Imóvel</th><th>Cliente</th><th>Valor</th><th>Validade</th><th>Status</th><th></th></tr></thead>
      <tbody>{lista.map(p => {
        const op = db.oportunidades.find(o => o.id === p.oportunidadeId)
        const vencida = p.status === 'em_analise' && p.validade < hoje()
        return <tr key={p.id}>
          <td>{db.imoveis.find(i => i.id === p.imovelId)?.codigo}</td>
          <td>{op ? <Link className="hover:underline" to={`/app/oportunidade/${op.id}`}>{db.pessoas.find(x => x.id === op.pessoaId)?.nome}</Link> : '—'}</td>
          <td className="font-semibold">{brl(p.valor)}</td>
          <td>{vencida ? <Badge cor="vermelho">{dataBR(p.validade)}</Badge> : dataBR(p.validade)}</td>
          <td><Badge cor={statusProposta[p.status][1]}>{statusProposta[p.status][0]}</Badge></td>
          <td><button className="text-sm font-semibold underline" onClick={() => onEditar(p)}>Editar</button></td>
        </tr>
      })}</tbody>
    </table></div>
  )
}

function PropostaModal({ proposta, onFechar }: { proposta: Proposta | null; onFechar: () => void }) {
  const [f, setF] = useState<Proposta | null>(proposta)
  if (proposta && f?.id !== proposta.id) setF(proposta)
  if (!proposta || !f) return null
  return (
    <Modal aberto onFechar={onFechar} titulo="Proposta">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => {
        e.preventDefault(); salvarItem('propostas', f)
        if (f.status === 'aceita') update(d => { const o = d.oportunidades.find(o => o.id === f.oportunidadeId); if (o && o.status === 'aberta') { o.status = 'ganha'; o.valor = f.valor; o.historico.unshift({ em: agoraISO(), texto: `Proposta de ${brl(f.valor)} aceita — negócio ganho` }) } })
        onFechar()
      }}>
        <Campo label="Valor"><input type="number" className="input" value={f.valor} onChange={e => setF({ ...f, valor: Number(e.target.value) })} /></Campo>
        <Campo label="Validade"><input type="date" className="input" value={f.validade} onChange={e => setF({ ...f, validade: e.target.value })} /></Campo>
        <Campo label="Status" className="sm:col-span-2"><select className="input" value={f.status} onChange={e => setF({ ...f, status: e.target.value as StatusProposta })}>{Object.entries(statusProposta).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></Campo>
        <Campo label="Condições e observações" className="sm:col-span-2"><textarea className="input" rows={4} value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} /></Campo>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary">Salvar</button></div>
      </form>
    </Modal>
  )
}

export function Propostas() {
  const lista = useDB(d => d.propostas)
  const [p, setP] = useState<Proposta | null>(null)
  return <>
    <PageHeader titulo="Propostas" sub="Todas as propostas registradas nas oportunidades" />
    <div className="card">{lista.length ? <PropostasTabela lista={lista} onEditar={setP} /> : <Vazio texto="Crie propostas a partir de uma oportunidade." />}</div>
    <PropostaModal proposta={p} onFechar={() => setP(null)} />
  </>
}

/* ---------------- Leads e roleta ---------------- */
export function Leads() {
  const db = useDB(d => d)
  const [aba, setAba] = useState<'leads' | 'roleta' | 'captura'>('leads')
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', mensagem: '', origem: 'Portal A', imovelId: '' })
  const r = db.config.roleta
  const ativos = r.corretores.filter(id => db.usuarios.some(u => u.id === id && u.ativo))
  return (
    <>
      <PageHeader titulo="Leads e roleta" sub="Entrada de contatos de todos os canais e distribuição automática" />
      <Tabs abas={[{ id: 'leads', nome: 'Leads recebidos' }, { id: 'roleta', nome: 'Roleta de distribuição' }, { id: 'captura', nome: 'Registrar lead' }]} ativa={aba} onChange={setAba} />
      {aba === 'leads' && <div className="card overflow-x-auto p-0"><table className="table">
        <thead><tr><th>Data</th><th>Lead</th><th>Origem</th><th>Corretor</th><th>Etapa</th><th>Status</th></tr></thead>
        <tbody>{[...db.oportunidades].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map(o => (
          <tr key={o.id}><td>{dataBR(o.criadoEm)}</td><td><Link className="font-semibold hover:underline" to={`/app/oportunidade/${o.id}`}>{o.titulo}</Link></td><td>{o.origem}</td>
            <td>{db.usuarios.find(u => u.id === o.corretorId)?.nome ?? <Badge cor="vermelho">sem corretor</Badge>}</td>
            <td>{db.funis.find(f => f.id === o.funilId)?.etapas.find(e => e.id === o.etapaId)?.nome}</td>
            <td><Badge cor={o.status === 'ganha' ? 'verde' : o.status === 'perdida' ? 'vermelho' : 'amarelo'}>{o.status}</Badge></td></tr>
        ))}</tbody></table></div>}
      {aba === 'roleta' && <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4">
          <label className="flex items-center gap-3 font-semibold"><input type="checkbox" className="h-5 w-5 accent-ink" checked={r.ativa} onChange={e => update(d => { d.config.roleta.ativa = e.target.checked })} />Roleta ativa</label>
          <p className="text-sm text-ink-muted">Quando ativa, cada lead novo (site, portais, WhatsApp, registro manual) é atribuído ao próximo corretor da fila.</p>
          <div><div className="label">Corretores na fila</div>
            {db.usuarios.filter(u => u.papel !== 'financeiro').map(u => (
              <label key={u.id} className="flex items-center gap-3 py-1 text-sm"><input type="checkbox" className="h-4 w-4 accent-ink" checked={r.corretores.includes(u.id)} onChange={e => update(d => { const c = d.config.roleta.corretores; d.config.roleta.corretores = e.target.checked ? [...c, u.id] : c.filter(x => x !== u.id); d.config.roleta.ponteiro = 0 })} />{u.nome}{!u.ativo && <Badge>inativo</Badge>}</label>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="mb-3 font-black">Fila atual</h2>
          <ol className="space-y-2">{ativos.map((id, i) => <li key={id} className={`flex items-center justify-between rounded-lg p-3 text-sm font-semibold ${i === r.ponteiro % Math.max(1, ativos.length) ? 'bg-brand' : 'bg-neutral-100'}`}><span>{i + 1}. {db.usuarios.find(u => u.id === id)?.nome}</span>{i === r.ponteiro % Math.max(1, ativos.length) && <span>próximo ▶</span>}</li>)}</ol>
          <div className="mt-4 text-sm text-ink-muted">Leads distribuídos por corretor:</div>
          {ativos.map(id => <div key={id} className="text-sm">{db.usuarios.find(u => u.id === id)?.nome}: <b>{db.oportunidades.filter(o => o.corretorId === id).length}</b></div>)}
        </div>
      </div>}
      {aba === 'captura' && <form className="card grid max-w-2xl gap-4 sm:grid-cols-2" onSubmit={e => {
        e.preventDefault(); capturarLead({ ...form, imovelId: form.imovelId || undefined }); notificar('Lead registrado e distribuído!'); setForm({ ...form, nome: '', email: '', telefone: '', mensagem: '' }); setAba('leads')
      }}>
        <p className="text-sm text-ink-muted sm:col-span-2">Use para leads de telefone, placa, portais ou qualquer canal sem integração. Ele passa pela roleta.</p>
        <Campo label="Nome"><input required className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></Campo>
        <Campo label="Telefone"><input className="input" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></Campo>
        <Campo label="E-mail"><input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Campo>
        <Campo label="Origem"><select className="input" value={form.origem} onChange={e => setForm({ ...form, origem: e.target.value })}>{origens.map(o => <option key={o}>{o}</option>)}</select></Campo>
        <Campo label="Imóvel" className="sm:col-span-2"><select className="input" value={form.imovelId} onChange={e => setForm({ ...form, imovelId: e.target.value })}><option value="">—</option>{db.imoveis.map(i => <option key={i.id} value={i.id}>{i.codigo} · {i.titulo}</option>)}</select></Campo>
        <Campo label="Mensagem" className="sm:col-span-2"><textarea className="input" rows={3} value={form.mensagem} onChange={e => setForm({ ...form, mensagem: e.target.value })} /></Campo>
        <div className="sm:col-span-2"><button className="btn-primary">Registrar lead</button></div>
      </form>}
    </>
  )
}

/* ---------------- Pessoas ---------------- */
const nomesTipo: Record<TipoPessoa, string> = { cliente: 'Cliente', proprietario: 'Proprietário', inquilino: 'Inquilino', fornecedor: 'Fornecedor' }
export function Pessoas() {
  const pessoas = useDB(d => d.pessoas)
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState<TipoPessoa | ''>('')
  const [edit, setEdit] = useState<Pessoa | null>(null)
  const lista = pessoas.filter(p => (!tipo || p.tipos.includes(tipo)) && (p.nome + p.email + p.telefone + p.documento).toLowerCase().includes(busca.toLowerCase()))
  return <>
    <PageHeader titulo="Pessoas" sub="Clientes, proprietários, inquilinos e fornecedores" acoes={<button className="btn-primary" onClick={() => setEdit({ id: uid(), nome: '', email: '', telefone: '', documento: '', tipos: ['cliente'], criadoEm: hoje() })}>+ Pessoa</button>} />
    <div className="mb-4 flex flex-wrap gap-2"><input className="input max-w-xs" placeholder="Buscar…" value={busca} onChange={e => setBusca(e.target.value)} />
      <select className="input w-auto" value={tipo} onChange={e => setTipo(e.target.value as TipoPessoa)}><option value="">Todos os tipos</option>{Object.entries(nomesTipo).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    <div className="card overflow-x-auto p-0"><table className="table">
      <thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Documento</th><th>Tipo</th><th></th></tr></thead>
      <tbody>{lista.map(p => <tr key={p.id}><td className="font-semibold">{p.nome}</td><td>{p.telefone}</td><td>{p.email}</td><td>{p.documento}</td><td className="space-x-1">{p.tipos.map(t => <Badge key={t} cor="amarelo">{nomesTipo[t]}</Badge>)}</td><td><button className="text-sm font-semibold underline" onClick={() => setEdit(p)}>Editar</button></td></tr>)}</tbody>
    </table></div>
    {edit && <Modal aberto onFechar={() => setEdit(null)} titulo="Pessoa">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); salvarItem('pessoas', edit); setEdit(null) }}>
        <Campo label="Nome" className="sm:col-span-2"><input required className="input" value={edit.nome} onChange={e => setEdit({ ...edit, nome: e.target.value })} /></Campo>
        <Campo label="Telefone"><input className="input" value={edit.telefone} onChange={e => setEdit({ ...edit, telefone: e.target.value })} /></Campo>
        <Campo label="E-mail"><input type="email" className="input" value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} /></Campo>
        <Campo label="CPF/CNPJ" className="sm:col-span-2"><input className="input" value={edit.documento} onChange={e => setEdit({ ...edit, documento: e.target.value })} /></Campo>
        <div className="sm:col-span-2"><div className="label">Tipo</div><div className="flex flex-wrap gap-4">{(Object.keys(nomesTipo) as TipoPessoa[]).map(t => <label key={t} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={edit.tipos.includes(t)} onChange={e => setEdit({ ...edit, tipos: e.target.checked ? [...edit.tipos, t] : edit.tipos.filter(x => x !== t) })} />{nomesTipo[t]}</label>)}</div></div>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancelar</button><button className="btn-primary">Salvar</button></div>
      </form>
    </Modal>}
  </>
}
