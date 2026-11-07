import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { planosAluguel, planosCRM, produtos } from './conteudo'
import { brl, num } from '../lib/format'
import { Campo, Logo } from '../components/ui'
import { useDB } from '../lib/store'

export function ProdutoPage() {
  const { slug } = useParams()
  const p = produtos.find(x => x.slug === slug)
  if (!p) return <NaoEncontrada />
  return (
    <main>
      <section className="bg-brand">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:py-20">
          <span className="badge bg-ink text-brand">{p.nome}</span>
          <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">{p.titulo}</h1>
          <p className="mt-5 max-w-2xl text-lg">{p.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/demonstracao" className="btn-dark px-6 py-3">Agendar demonstração</Link>
            <Link to={`/login?r=${encodeURIComponent(p.appRota)}`} className="btn bg-white px-6 py-3 text-ink hover:bg-neutral-100">Experimentar no sistema</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-16 md:grid-cols-2 lg:grid-cols-3">
        {p.blocos.map(b => (
          <div key={b.titulo} className="rounded-2xl border-2 border-ink p-6">
            <h2 className="text-xl font-black">{b.titulo}</h2>
            <p className="mt-2 text-sm text-ink-muted">{b.texto}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {b.itens.map(i => <li key={i} className="flex gap-2"><span className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-brand ring-1 ring-ink" />{i}</li>)}
            </ul>
          </div>
        ))}
      </section>
      <section className="px-4 pb-20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 rounded-3xl bg-ink px-8 py-10 text-white">
          <div><h2 className="text-2xl font-black">Integrado a todos os outros módulos</h2><p className="mt-1 text-neutral-400">Os dados entram uma vez e servem a imobiliária inteira.</p></div>
          <Link to="/planos" className="btn-primary px-6 py-3">Ver planos</Link>
        </div>
      </section>
    </main>
  )
}

export function Planos() {
  const [aba, setAba] = useState<'crm' | 'aluguel'>('crm')
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-center text-4xl font-black tracking-tight sm:text-5xl">Planos</h1>
      <p className="mt-3 text-center text-ink-muted">Escolha o pacote pelo tamanho da equipe e da carteira. Valores mensais de referência.</p>
      <div className="mx-auto mt-8 flex w-fit rounded-full border-2 border-ink p-1">
        <button onClick={() => setAba('crm')} className={`rounded-full px-5 py-2 text-sm font-bold ${aba === 'crm' ? 'bg-ink text-brand' : ''}`}>CRM + Site</button>
        <button onClick={() => setAba('aluguel')} className={`rounded-full px-5 py-2 text-sm font-bold ${aba === 'aluguel' ? 'bg-ink text-brand' : ''}`}>Gestão de Aluguéis</button>
      </div>
      <div className={`mt-10 grid gap-5 ${aba === 'crm' ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
        {(aba === 'crm' ? planosCRM : planosAluguel).map(pl => (
          <div key={pl.nome} className={`relative flex flex-col rounded-2xl border-2 p-6 ${pl.destaque ? 'border-ink bg-brand shadow-[8px_8px_0_#0A0A0A]' : 'border-neutral-200'}`}>
            {pl.destaque && <span className="badge absolute -top-3 left-6 bg-ink text-brand">Mais escolhido</span>}
            <div className="text-lg font-black">{pl.nome}</div>
            <div className="mt-3 font-display text-3xl font-black">{brl(pl.preco)}<span className="text-sm font-semibold">/mês</span></div>
            <div className="mt-3 space-y-1 text-sm font-semibold">
              {'usuarios' in pl ? <><div>{pl.usuarios} usuários</div><div>{num(pl.imoveis)} imóveis ativos</div><div>{pl.ia} créditos de IA/mês</div></> : <div>{pl.contratos} contratos inclusos</div>}
            </div>
            <ul className="mt-5 flex-1 space-y-2 text-sm">{pl.itens.map(i => <li key={i}>✓ {i}</li>)}</ul>
            <Link to={`/demonstracao?plano=${encodeURIComponent(pl.nome)}`} className={`mt-6 ${pl.destaque ? 'btn-dark' : 'btn-ghost'}`}>Quero o {pl.nome}</Link>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-ink-muted">Assinatura eletrônica cobrada por documento enviado. Usuários e contratos adicionais sob consulta.</p>
    </main>
  )
}

export function Integracoes() {
  const grupos = [
    { t: 'Portais imobiliários', i: ['Publicação de imóveis por XML', 'Recebimento de leads dos portais', 'Status de publicação por imóvel'] },
    { t: 'Marketing', i: ['Formulários de anúncios em redes sociais', 'Ferramentas de automação de marketing', 'Webhooks para qualquer plataforma'] },
    { t: 'Comunicação', i: ['WhatsApp para régua de cobrança', 'E-mail transacional', 'SMS'] },
    { t: 'Serviços', i: ['Vistoria de imóveis', 'Seguro incêndio e fiança', 'Assinatura eletrônica'] },
    { t: 'Desenvolvedores', i: ['API REST', 'Webhooks de eventos do CRM', 'Exportação de dados'] },
    { t: 'IA', i: ['Consulta de dados por assistentes de IA', 'Atendimento automático de leads', 'Geração de conteúdo'] },
  ]
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Integrações</h1>
      <p className="mt-3 max-w-2xl text-ink-muted">Conecte o Guarita Mob às ferramentas que a sua imobiliária já usa.</p>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {grupos.map(g => (
          <div key={g.t} className="rounded-2xl border-2 border-ink p-6">
            <h2 className="text-lg font-black">{g.t}</h2>
            <ul className="mt-3 space-y-2 text-sm">{g.i.map(i => <li key={i}>■ {i}</li>)}</ul>
          </div>
        ))}
      </div>
    </main>
  )
}

export function Demonstracao() {
  const [ok, setOk] = useState(false)
  const plano = new URLSearchParams(location.search).get('plano') ?? ''
  const enviar = (e: FormEvent) => { e.preventDefault(); setOk(true) }
  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2">
      <div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Agende uma demonstração</h1>
        <p className="mt-4 text-ink-muted">Um especialista mostra o sistema com o fluxo da sua imobiliária e tira suas dúvidas sobre planos e migração.</p>
        <ul className="mt-6 space-y-3 text-sm font-semibold">
          <li>■ Diagnóstico da operação</li><li>■ Migração dos dados</li><li>■ Treinamento da equipe</li><li>■ Acompanhamento no início</li>
        </ul>
      </div>
      <div className="rounded-2xl border-2 border-ink p-6">
        {ok ? (
          <div className="py-10 text-center"><div className="text-5xl">✓</div><h2 className="mt-3 text-2xl font-black">Pedido recebido!</h2><p className="mt-2 text-ink-muted">Entraremos em contato em breve.</p></div>
        ) : (
          <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nome" className="sm:col-span-2"><input required className="input" /></Campo>
            <Campo label="E-mail"><input required type="email" className="input" /></Campo>
            <Campo label="WhatsApp"><input required className="input" /></Campo>
            <Campo label="Imobiliária"><input required className="input" /></Campo>
            <Campo label="Tamanho da equipe"><select className="input"><option>1 a 5</option><option>6 a 15</option><option>16 a 50</option><option>Mais de 50</option></select></Campo>
            <Campo label="Plano de interesse" className="sm:col-span-2"><input className="input" defaultValue={plano} /></Campo>
            <button className="btn-primary sm:col-span-2 py-3">Quero conhecer</button>
          </form>
        )}
      </div>
    </main>
  )
}

export function Login() {
  const nav = useNavigate()
  const usuarios = useDB(db => db.usuarios)
  const [email, setEmail] = useState(usuarios[0]?.email ?? '')
  const destino = new URLSearchParams(location.search).get('r') ?? '/app'
  const entrar = (e: FormEvent) => {
    e.preventDefault()
    const u = usuarios.find(u => u.email === email) ?? usuarios[0]
    try { localStorage.setItem('guarita-mob-sessao', u.id) } catch { /* sem armazenamento */ }
    nav(destino)
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand p-12 lg:flex">
        <Logo />
        <div><h1 className="text-5xl font-black leading-tight">Bom te ver de novo.</h1><p className="mt-4 text-lg">Seus leads, contratos e números esperando por você.</p></div>
        <div className="text-sm font-semibold">© Guarita Mob</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={entrar} className="w-full max-w-sm space-y-4">
          <div className="lg:hidden"><Logo /></div>
          <h2 className="text-2xl font-black">Entrar</h2>
          <Campo label="E-mail"><input className="input" value={email} onChange={e => setEmail(e.target.value)} list="usuarios-demo" /></Campo>
          <datalist id="usuarios-demo">{usuarios.map(u => <option key={u.id} value={u.email}>{u.nome}</option>)}</datalist>
          <Campo label="Senha"><input className="input" type="password" defaultValue="demo1234" /></Campo>
          <button className="btn-dark w-full py-3">Entrar</button>
          <p className="text-xs text-ink-muted">Versão de demonstração: escolha qualquer usuário da lista. Os dados ficam salvos neste navegador.</p>
          <Link to="/" className="block text-sm font-semibold underline">← Voltar ao site</Link>
        </form>
      </div>
    </div>
  )
}

export function NaoEncontrada() {
  return <main className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="text-6xl font-black">404</h1><p className="mt-3 text-ink-muted">Página não encontrada.</p><Link to="/" className="btn-primary mt-6">Ir para o início</Link></main>
}
