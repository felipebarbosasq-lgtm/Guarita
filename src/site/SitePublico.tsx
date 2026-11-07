import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { capturarLead, update, useDB } from '../lib/store'
import { agoraISO, brl, dataBR, hoje, placeholderFoto, uid } from '../lib/format'
import type { Imovel, SiteConfig, TipoComponenteSite } from '../lib/types'

function registrarVisita(pagina: string, imovelId?: string) {
  if (new URLSearchParams(location.search).has('previa')) return
  update(d => { d.analytics.visitas.push({ data: hoje(), pagina, imovelId }); if (d.analytics.visitas.length > 5000) d.analytics.visitas.splice(0, 1000) })
}

const foto = (i: Imovel) => i.fotos[0] ?? placeholderFoto(i.id, i.codigo)
const ativos = (lista: Imovel[]) => lista.filter(i => i.publicadoSite && (i.status === 'disponivel' || i.status === 'reservado'))

export function SiteLayout() {
  const site = useDB(d => d.site)
  const loc = useLocation()
  const previa = new URLSearchParams(loc.search).has('previa')
  const q = previa ? '?previa=1' : ''
  const estilo = { '--cp': site.corPrimaria, '--cs': site.corSecundaria, fontFamily: site.fonte } as CSSProperties
  return (
    <div style={estilo} className="min-h-screen bg-white text-[color:var(--cs)]">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to={`/s${q}`} className="text-lg font-black"><span className="mr-1 inline-block rounded px-1.5" style={{ background: 'var(--cp)' }}>■</span>{site.nome}</Link>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <Link to={`/s/imoveis?finalidade=venda${previa ? '&previa=1' : ''}`} className="hidden sm:inline">Comprar</Link>
            <Link to={`/s/imoveis?finalidade=aluguel${previa ? '&previa=1' : ''}`} className="hidden sm:inline">Alugar</Link>
            {site.posts.length > 0 && <Link to={`/s/blog${q}`} className="hidden sm:inline">Blog</Link>}
            {site.paginas.map(p => <Link key={p.id} to={`/s/pagina/${p.id}${q}`} className="hidden md:inline">{p.titulo}</Link>)}
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2" style={{ background: 'var(--cp)', color: 'var(--cs)' }}>WhatsApp</a>
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="mt-16 py-10 text-sm text-white" style={{ background: 'var(--cs)' }}>
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-3">
          <div><div className="text-lg font-black">{site.nome}</div><p className="mt-2 opacity-70">{site.slogan}</p></div>
          <div className="opacity-80">{site.endereco}<br />{site.email}</div>
          <div className="opacity-80"><Link to="/portal" className="underline">Área do cliente</Link><br /><span className="text-xs">Site feito com Guarita Mob</span></div>
        </div>
      </footer>
    </div>
  )
}

function CardImovel({ i, previa }: { i: Imovel; previa: boolean }) {
  const marca = useDB(d => d.site.marcaDagua)
  const nomeSite = useDB(d => d.site.nome)
  return (
    <Link to={`/s/imovel/${i.id}${previa ? '?previa=1' : ''}`} className="group overflow-hidden rounded-xl border border-black/10 bg-white transition hover:shadow-lg">
      <div className="relative"><img src={foto(i)} alt={i.titulo} className="aspect-[4/3] w-full object-cover" />
        {marca && <span className="absolute bottom-2 right-2 text-xs font-black text-white/80 drop-shadow">{nomeSite}</span>}
        <span className="absolute left-2 top-2 rounded px-2 py-0.5 text-xs font-bold" style={{ background: 'var(--cp)' }}>{i.finalidade === 'aluguel' ? 'Aluguel' : 'Venda'}</span>
        {i.status === 'reservado' && <span className="absolute right-2 top-2 rounded bg-black px-2 py-0.5 text-xs font-bold text-white">Reservado</span>}
      </div>
      <div className="p-4">
        <div className="text-xs opacity-60">{i.tipo} · {i.bairro}, {i.cidade}</div>
        <div className="mt-1 font-bold group-hover:underline">{i.titulo}</div>
        <div className="mt-2 text-sm opacity-80">{[i.area && `${i.area} m²`, i.quartos && `${i.quartos} qts`, i.vagas && `${i.vagas} vagas`].filter(Boolean).join(' · ')}</div>
        <div className="mt-3 text-xl font-black">{brl(i.preco)}{i.finalidade === 'aluguel' && <span className="text-xs">/mês</span>}</div>
      </div>
    </Link>
  )
}

function Secao({ titulo, children, cinza = false }: { titulo?: string; children: ReactNode; cinza?: boolean }) {
  return <section className={cinza ? 'bg-black/[0.03]' : ''}><div className="mx-auto max-w-6xl px-4 py-12">{titulo && <h2 className="mb-6 text-2xl font-black">{titulo}</h2>}{children}</div></section>
}

function FormContato({ imovelId, origem = 'Site', titulo = 'Fale com a gente' }: { imovelId?: string; origem?: string; titulo?: string }) {
  const [ok, setOk] = useState(false)
  const [f, setF] = useState({ nome: '', email: '', telefone: '', mensagem: '' })
  const previa = new URLSearchParams(location.search).has('previa')
  const enviar = (e: FormEvent) => { e.preventDefault(); if (!previa) capturarLead({ ...f, origem, imovelId }); setOk(true) }
  if (ok) return <div className="rounded-xl p-6 text-center font-bold" style={{ background: 'var(--cp)' }}>Mensagem enviada! Um corretor vai falar com você em breve.</div>
  return (
    <form onSubmit={enviar} className="grid gap-3 rounded-xl border border-black/10 p-5">
      <div className="text-lg font-black">{titulo}</div>
      <input required className="input" placeholder="Seu nome" value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} />
      <input required className="input" placeholder="Telefone / WhatsApp" value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} />
      <input type="email" className="input" placeholder="E-mail" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
      <textarea className="input" rows={3} placeholder="Mensagem" value={f.mensagem} onChange={e => setF({ ...f, mensagem: e.target.value })} />
      <button className="rounded-lg px-4 py-3 font-bold" style={{ background: 'var(--cs)', color: 'var(--cp)' }}>Enviar</button>
    </form>
  )
}

function Busca({ previa }: { previa: boolean }) {
  const nav = useNavigate()
  const [f, setF] = useState({ finalidade: 'venda', tipo: '', bairro: '' })
  return (
    <form onSubmit={e => { e.preventDefault(); nav(`/s/imoveis?${new URLSearchParams({ ...f, ...(previa ? { previa: '1' } : {}) })}`) }} className="grid gap-2 rounded-2xl bg-white p-3 shadow-xl sm:grid-cols-4">
      <select className="input" value={f.finalidade} onChange={e => setF({ ...f, finalidade: e.target.value })}><option value="venda">Comprar</option><option value="aluguel">Alugar</option></select>
      <input className="input" placeholder="Tipo (ex.: Apartamento)" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })} />
      <input className="input" placeholder="Bairro ou cidade" value={f.bairro} onChange={e => setF({ ...f, bairro: e.target.value })} />
      <button className="rounded-lg px-4 py-2 font-bold" style={{ background: 'var(--cs)', color: 'var(--cp)' }}>Buscar</button>
    </form>
  )
}

function Componente({ tipo, site, previa }: { tipo: TipoComponenteSite; site: SiteConfig; previa: boolean }) {
  const db = useDB(d => d)
  const lista = ativos(db.imoveis)
  const grade = (xs: Imovel[]) => xs.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{xs.slice(0, 6).map(i => <CardImovel key={i.id} i={i} previa={previa} />)}</div> : <p className="opacity-60">Nenhum imóvel no momento.</p>
  switch (tipo) {
    case 'banner': return <section style={{ background: 'var(--cp)' }}><div className="mx-auto max-w-6xl px-4 py-16 sm:py-24"><h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">{site.slogan}</h1><p className="mt-4 max-w-xl text-lg opacity-80">{site.nome} · compra, venda e aluguel de imóveis.</p></div></section>
    case 'busca': return <section style={{ background: 'var(--cp)' }}><div className="mx-auto max-w-6xl px-4 pb-12"><Busca previa={previa} /></div></section>
    case 'destaques': return <Secao titulo="Destaques">{grade(lista.filter(i => i.destaque))}</Secao>
    case 'venda': return <Secao titulo="À venda" cinza>{grade(lista.filter(i => i.finalidade === 'venda'))}</Secao>
    case 'aluguel': return <Secao titulo="Para alugar">{grade(lista.filter(i => i.finalidade === 'aluguel'))}</Secao>
    case 'lancamentos': return <Secao titulo="Lançamentos" cinza>{grade(lista.filter(i => i.criadoEm >= new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)))}</Secao>
    case 'sobre': return <Secao titulo="Quem somos"><p className="max-w-3xl text-lg opacity-80">{site.sobre}</p></Secao>
    case 'equipe': return <Secao titulo="Nossa equipe" cinza><div className="grid gap-4 sm:grid-cols-4">{db.usuarios.filter(u => u.ativo && u.papel !== 'financeiro').map(u => <div key={u.id} className="rounded-xl bg-white p-5 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-xl font-black" style={{ background: 'var(--cp)' }}>{u.nome[0]}</div><div className="mt-3 font-bold">{u.nome}</div><div className="text-xs opacity-60">{u.telefone}</div></div>)}</div></Secao>
    case 'depoimentos': return <Secao titulo="O que dizem os clientes"><div className="grid gap-4 sm:grid-cols-3">{['Atendimento rápido e atencioso do começo ao fim.', 'Encontrei meu apartamento em duas semanas.', 'Administram meu imóvel há anos e o repasse nunca atrasou.'].map((t, i) => <blockquote key={i} className="rounded-xl border border-black/10 p-5">“{t}”<div className="mt-3 text-sm font-bold">Cliente {site.nome}</div></blockquote>)}</div></Secao>
    case 'contato': return <Secao titulo="Contato" cinza><div className="grid gap-6 md:grid-cols-2"><FormContato /><div className="space-y-2 text-lg"><div>📍 {site.endereco}</div><div>✉ {site.email}</div><a className="font-bold underline" href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noreferrer">💬 Chamar no WhatsApp</a></div></div></Secao>
    case 'blog': return site.posts.length ? <Secao titulo="Do nosso blog"><div className="grid gap-4 sm:grid-cols-3">{site.posts.slice(0, 3).map(p => <Link key={p.id} to={`/s/blog${previa ? '?previa=1' : ''}#${p.id}`} className="rounded-xl border border-black/10 p-5 hover:shadow"><div className="text-xs opacity-60">{dataBR(p.em)}</div><div className="mt-1 font-bold">{p.titulo}</div><p className="mt-2 line-clamp-3 text-sm opacity-70">{p.conteudo}</p></Link>)}</div></Secao> : null
    case 'servicos': return <Secao titulo="Serviços" cinza><div className="grid gap-4 sm:grid-cols-3">{[['Venda', 'Avaliação, divulgação e negociação do seu imóvel.'], ['Locação', 'Seleção de inquilinos e contrato seguro.'], ['Administração', 'Cobrança, repasse e manutenção sem dor de cabeça.']].map(([t, d]) => <div key={t} className="rounded-xl bg-white p-5"><div className="font-black">{t}</div><p className="mt-1 text-sm opacity-70">{d}</p></div>)}</div></Secao>
    case 'numeros': return <section style={{ background: 'var(--cs)', color: 'var(--cp)' }}><div className="mx-auto grid max-w-6xl grid-cols-3 gap-4 px-4 py-10 text-center">{[[lista.length, 'imóveis disponíveis'], [db.contratos.filter(c => c.status === 'ativo').length, 'imóveis administrados'], [db.usuarios.filter(u => u.ativo).length, 'profissionais']].map(([n, t]) => <div key={String(t)}><div className="text-4xl font-black">{n}</div><div className="text-sm">{t}</div></div>)}</div></section>
    case 'mapa': return <Secao titulo="Onde estamos"><iframe title="Mapa" className="h-72 w-full rounded-xl border-0" loading="lazy" src={`https://www.google.com/maps?q=${encodeURIComponent(site.endereco)}&output=embed`} /></Secao>
    case 'anuncie': return <section className="px-4 py-12"><div className="mx-auto grid max-w-6xl items-center gap-6 rounded-2xl p-8 md:grid-cols-2" style={{ background: 'var(--cs)', color: 'white' }}><div><h2 className="text-3xl font-black" style={{ color: 'var(--cp)' }}>Quer vender ou alugar seu imóvel?</h2><p className="mt-2 opacity-80">Deixe seu contato e avaliamos sem compromisso.</p></div><div className="text-[color:var(--cs)]"><FormContato origem="Site (anuncie)" titulo="Anuncie com a gente" /></div></div></section>
  }
}

export function SiteHome() {
  const site = useDB(d => d.site)
  const previa = new URLSearchParams(useLocation().search).has('previa')
  useEffect(() => registrarVisita('Início'), [])
  return <main>{site.componentes.filter(c => c.ativo).map(c => <Componente key={c.id} tipo={c.tipo} site={site} previa={previa} />)}</main>
}

export function SiteBusca() {
  const imoveis = useDB(d => d.imoveis)
  const loc = useLocation()
  const nav = useNavigate()
  const p = new URLSearchParams(loc.search)
  const previa = p.has('previa')
  const f = { finalidade: p.get('finalidade') ?? '', tipo: p.get('tipo') ?? '', bairro: p.get('bairro') ?? '', precoMax: p.get('precoMax') ?? '', quartos: p.get('quartos') ?? '', ordem: p.get('ordem') ?? 'recentes' }
  const setF = (k: string, v: string) => { const n = new URLSearchParams(loc.search); if (v) n.set(k, v); else n.delete(k); nav(`/s/imoveis?${n}`, { replace: true }) }
  useEffect(() => registrarVisita('Busca'), [])
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const lista = ativos(imoveis).filter(i => (!f.finalidade || i.finalidade === f.finalidade) && (!f.tipo || norm(i.tipo).includes(norm(f.tipo))) && (!f.bairro || norm(i.bairro + ' ' + i.cidade).includes(norm(f.bairro))) && (!f.precoMax || i.preco <= Number(f.precoMax)) && (!f.quartos || i.quartos >= Number(f.quartos)))
    .sort((a, b) => f.ordem === 'menor' ? a.preco - b.preco : f.ordem === 'maior' ? b.preco - a.preco : b.criadoEm.localeCompare(a.criadoEm))
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-black">{f.finalidade === 'aluguel' ? 'Imóveis para alugar' : f.finalidade === 'venda' ? 'Imóveis à venda' : 'Imóveis'}</h1>
      <div className="mt-6 grid gap-2 rounded-xl border border-black/10 p-3 sm:grid-cols-3 lg:grid-cols-6">
        <select className="input" value={f.finalidade} onChange={e => setF('finalidade', e.target.value)}><option value="">Comprar ou alugar</option><option value="venda">Comprar</option><option value="aluguel">Alugar</option></select>
        <input className="input" placeholder="Tipo" value={f.tipo} onChange={e => setF('tipo', e.target.value)} />
        <input className="input" placeholder="Bairro/cidade" value={f.bairro} onChange={e => setF('bairro', e.target.value)} />
        <input className="input" type="number" placeholder="Preço máximo" value={f.precoMax} onChange={e => setF('precoMax', e.target.value)} />
        <select className="input" value={f.quartos} onChange={e => setF('quartos', e.target.value)}><option value="">Quartos</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+</option>)}</select>
        <select className="input" value={f.ordem} onChange={e => setF('ordem', e.target.value)}><option value="recentes">Mais recentes</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option></select>
      </div>
      <p className="my-4 text-sm opacity-60">{lista.length} imóveis encontrados</p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{lista.map(i => <CardImovel key={i.id} i={i} previa={previa} />)}</div>
    </main>
  )
}

export function SiteImovel() {
  const { id } = useParams()
  const db = useDB(d => d)
  const [n, setN] = useState(0)
  const i = db.imoveis.find(x => x.id === id && x.publicadoSite)
  useEffect(() => { if (i) registrarVisita(`Imóvel ${i.codigo}`, i.id) }, [i?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!i) return <main className="mx-auto max-w-6xl px-4 py-20 text-center"><h1 className="text-3xl font-black">Imóvel indisponível</h1><Link to="/s/imoveis" className="mt-4 inline-block underline">Ver outros imóveis</Link></main>
  const fotos = i.fotos.length ? i.fotos : [foto(i)]
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-sm opacity-60">{i.tipo} · {i.finalidade === 'aluguel' ? 'Aluguel' : 'Venda'} · Cód. {i.codigo}</div>
      <h1 className="mt-1 text-3xl font-black">{i.titulo}</h1>
      <div className="opacity-70">{i.endereco ? i.endereco + ' · ' : ''}{i.bairro}, {i.cidade}</div>
      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative"><img src={fotos[n]} alt={i.titulo} className="aspect-video w-full rounded-xl object-cover" />{db.site.marcaDagua && <span className="absolute bottom-3 right-4 text-lg font-black text-white/80 drop-shadow">{db.site.nome}</span>}</div>
          {fotos.length > 1 && <div className="mt-2 flex gap-2 overflow-x-auto">{fotos.map((f, k) => <button key={k} onClick={() => setN(k)}><img src={f} alt="" className={`h-16 w-24 rounded object-cover ${k === n ? 'ring-4 ring-[color:var(--cp)]' : 'opacity-70'}`} /></button>)}</div>}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Área', `${i.area} m²`], ['Quartos', i.quartos], ['Banheiros', i.banheiros], ['Vagas', i.vagas]].map(([k, v]) => <div key={String(k)} className="rounded-xl border border-black/10 p-4"><div className="text-xs opacity-60">{k}</div><div className="text-xl font-black">{v}</div></div>)}</div>
          <h2 className="mt-8 text-xl font-black">Sobre o imóvel</h2>
          <p className="mt-2 whitespace-pre-line opacity-80">{i.descricao || 'Entre em contato para mais informações.'}</p>
        </div>
        <aside className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--cp)' }}>
            <div className="text-sm font-semibold">{i.finalidade === 'aluguel' ? 'Aluguel' : 'Valor de venda'}</div>
            <div className="text-3xl font-black">{brl(i.preco)}</div>
            {(i.condominio > 0 || i.iptu > 0) && <div className="mt-1 text-sm">Condomínio {brl(i.condominio)} · IPTU {brl(i.iptu)}</div>}
            <a href={`https://wa.me/${db.site.whatsapp}?text=${encodeURIComponent(`Olá! Tenho interesse no imóvel ${i.codigo} — ${i.titulo}`)}`} target="_blank" rel="noreferrer" className="mt-4 block rounded-lg py-3 text-center font-bold" style={{ background: 'var(--cs)', color: 'var(--cp)' }}>Chamar no WhatsApp</a>
          </div>
          <FormContato imovelId={i.id} titulo="Quero mais informações" />
        </aside>
      </div>
    </main>
  )
}

/** Vitrine personalizada enviada ao cliente a partir de uma oportunidade do CRM. */
export function SiteSelecao() {
  const { id } = useParams()
  const db = useDB(d => d)
  const [pedido, setPedido] = useState<string | null>(null)
  const [data, setData] = useState(hoje())
  const o = db.oportunidades.find(o => o.id === id)
  if (!o) return <main className="mx-auto max-w-6xl px-4 py-20 text-center"><h1 className="text-3xl font-black">Seleção não encontrada</h1></main>
  const pessoa = db.pessoas.find(p => p.id === o.pessoaId)
  const corretor = db.usuarios.find(u => u.id === o.corretorId)
  const pf = o.perfil
  const lista = ativos(db.imoveis).filter(i => (!pf.finalidade || i.finalidade === pf.finalidade) && (!pf.tipo || i.tipo === pf.tipo) && (!pf.precoMax || i.preco <= pf.precoMax) && (!pf.quartosMin || i.quartos >= pf.quartosMin) && (!pf.bairro || i.bairro.toLowerCase().includes(pf.bairro.toLowerCase())))
  const agendar = (imovelId: string) => {
    const im = db.imoveis.find(i => i.id === imovelId)!
    update(d => {
      d.atividades.unshift({ id: uid(), oportunidadeId: o.id, tipo: 'visita', descricao: `Visita solicitada pelo cliente: ${im.codigo} em ${dataBR(data)}`, prazo: data, responsavelId: o.corretorId, concluida: false })
      const x = d.oportunidades.find(x => x.id === o.id)!; x.atualizadoEm = hoje(); x.historico.unshift({ em: agoraISO(), texto: `Cliente pediu visita ao ${im.codigo} pela vitrine (${dataBR(data)})` })
    })
    setPedido(null)
    alert('Pedido de visita enviado! O corretor vai confirmar com você.')
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-2xl p-8" style={{ background: 'var(--cp)' }}>
        <div className="text-sm font-semibold">Seleção exclusiva</div>
        <h1 className="mt-1 text-3xl font-black">Olá, {pessoa?.nome.split(' ')[0]}! Separamos estes imóveis para você.</h1>
        {corretor && <p className="mt-2">Seu corretor: <b>{corretor.nome}</b> · {corretor.telefone}</p>}
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map(i => <div key={i.id} className="flex flex-col"><CardImovel i={i} previa={false} /><button onClick={() => setPedido(i.id)} className="mt-2 rounded-lg py-2 font-bold" style={{ background: 'var(--cs)', color: 'var(--cp)' }}>Agendar visita</button></div>)}
        {!lista.length && <p className="opacity-60">Estamos procurando imóveis com o seu perfil. Em breve teremos novidades!</p>}
      </div>
      {pedido && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPedido(null)}>
        <div className="w-full max-w-sm rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
          <h2 className="text-xl font-black">Quando você quer visitar?</h2>
          <input type="date" min={hoje()} className="input mt-4" value={data} onChange={e => setData(e.target.value)} />
          <button className="mt-4 w-full rounded-lg py-3 font-bold" style={{ background: 'var(--cs)', color: 'var(--cp)' }} onClick={() => agendar(pedido)}>Confirmar pedido</button>
        </div>
      </div>}
    </main>
  )
}

export function SiteBlog() {
  const posts = useDB(d => d.site.posts)
  useEffect(() => registrarVisita('Blog'), [])
  return <main className="mx-auto max-w-3xl px-4 py-10"><h1 className="text-3xl font-black">Blog</h1>{posts.map(p => <article key={p.id} id={p.id} className="mt-8 border-b border-black/10 pb-8"><div className="text-xs opacity-60">{dataBR(p.em)}</div><h2 className="mt-1 text-2xl font-black">{p.titulo}</h2><p className="mt-3 whitespace-pre-line opacity-80">{p.conteudo}</p></article>)}</main>
}

export function SitePagina() {
  const { id } = useParams()
  const p = useDB(d => d.site.paginas.find(x => x.id === id))
  useEffect(() => { if (p) registrarVisita(p.titulo) }, [p?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return <main className="mx-auto max-w-3xl px-4 py-20 text-center"><h1 className="text-3xl font-black">Página não encontrada</h1></main>
  return <main className="mx-auto max-w-3xl px-4 py-10"><h1 className="text-3xl font-black">{p.titulo}</h1><p className="mt-4 whitespace-pre-line text-lg opacity-80">{p.conteudo}</p></main>
}
