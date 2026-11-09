import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/ui'
import { produtos } from './conteudo'

export default function MarketingLayout() {
  const [menu, setMenu] = useState(false)
  const [mobile, setMobile] = useState(false)
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex">
            <div className="relative" onMouseEnter={() => setMenu(true)} onMouseLeave={() => setMenu(false)}>
              <button className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-neutral-100" onClick={() => setMenu(m => !m)}>Produtos ▾</button>
              {menu && (
                <div className="absolute left-0 top-full w-[560px] pt-2">
                  <div className="grid grid-cols-2 gap-1 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl">
                    {produtos.map(p => (
                      <Link key={p.slug} to={`/${p.slug}`} onClick={() => setMenu(false)} className="rounded-xl p-3 hover:bg-brand-light">
                        <div className="text-sm font-bold">{p.nome}</div>
                        <div className="text-xs text-ink-muted">{p.menu}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <NavLink to="/integracoes" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-neutral-100">Integrações</NavLink>
            <NavLink to="/planos" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-neutral-100">Planos</NavLink>
            <NavLink to="/s/demo" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-neutral-100">Ver site de exemplo</NavLink>
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <Link to="/login" className="btn-ghost">Entrar</Link>
            <Link to="/demonstracao" className="btn-dark">Agendar demonstração</Link>
          </div>
          <button className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold lg:hidden" onClick={() => setMobile(m => !m)} aria-label="Menu">☰</button>
        </div>
        {mobile && (
          <div className="border-t border-neutral-200 px-4 py-3 lg:hidden">
            {produtos.map(p => <Link key={p.slug} to={`/${p.slug}`} onClick={() => setMobile(false)} className="block py-2 text-sm font-semibold">{p.nome}</Link>)}
            <Link to="/integracoes" onClick={() => setMobile(false)} className="block py-2 text-sm font-semibold">Integrações</Link>
            <Link to="/planos" onClick={() => setMobile(false)} className="block py-2 text-sm font-semibold">Planos</Link>
            <div className="mt-3 flex gap-2"><Link to="/login" className="btn-ghost flex-1">Entrar</Link><Link to="/demonstracao" className="btn-dark flex-1">Demonstração</Link></div>
          </div>
        )}
      </header>
      <Outlet />
      <footer className="bg-ink text-neutral-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo dark />
            <p className="mt-4 max-w-sm text-sm">CRM, ERP, site e gestão de aluguéis para imobiliárias, numa base de dados só.</p>
          </div>
          <div>
            <div className="mb-3 text-sm font-bold text-brand">Produtos</div>
            {produtos.map(p => <Link key={p.slug} to={`/${p.slug}`} className="block py-1 text-sm hover:text-white">{p.nome}</Link>)}
          </div>
          <div>
            <div className="mb-3 text-sm font-bold text-brand">Empresa</div>
            <Link to="/planos" className="block py-1 text-sm hover:text-white">Planos</Link>
            <Link to="/integracoes" className="block py-1 text-sm hover:text-white">Integrações</Link>
            <Link to="/demonstracao" className="block py-1 text-sm hover:text-white">Contato</Link>
          </div>
          <div>
            <div className="mb-3 text-sm font-bold text-brand">Acesso</div>
            <Link to="/login" className="block py-1 text-sm hover:text-white">Entrar no sistema</Link>
            <Link to="/s/demo" className="block py-1 text-sm hover:text-white">Site de exemplo</Link>
            <Link to="/portal/demo" className="block py-1 text-sm hover:text-white">Área do inquilino e proprietário</Link>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-neutral-500">© {new Date().getFullYear()} Guarita Mob. Todos os direitos reservados.</div>
      </footer>
    </div>
  )
}
