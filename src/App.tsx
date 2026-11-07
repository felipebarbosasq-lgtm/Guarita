import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ToastHost } from './components/ui'
import MarketingLayout from './marketing/MarketingLayout'
import Home from './marketing/Home'
import { Demonstracao, Integracoes, Login, NaoEncontrada, Planos, ProdutoPage } from './marketing/Paginas'
import AppLayout from './app/AppLayout'
import { Agenda, Dashboard } from './app/Painel'
import { Funil, Leads, OportunidadeDetalhe, Pessoas, Propostas } from './app/CRM'
import { Chaves, Imoveis } from './app/Imoveis'
import { Carteira, Contratos, Faturas, Repasses } from './app/Locacao'
import { CadastrosFinanceiros, Conciliacao, DRE, Financeiro } from './app/Financeiro'
import { Analytics, EditorSite, IA } from './app/Marketing'
import { Configuracoes, Equipe } from './app/Admin'
import { SiteBlog, SiteBusca, SiteHome, SiteImovel, SiteLayout, SitePagina, SiteSelecao } from './site/SitePublico'
import Portal from './site/Portal'

function RolarAoTopo() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function Protegido({ children }: { children: ReactNode }) {
  let ok = false
  try { ok = !!localStorage.getItem('guarita-mob-sessao') } catch { ok = true }
  const loc = useLocation()
  return ok ? <>{children}</> : <Navigate to={`/login?r=${encodeURIComponent(loc.pathname)}`} replace />
}

export default function App() {
  return (
    <>
      <RolarAoTopo />
      <ToastHost />
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route index element={<Home />} />
          <Route path="planos" element={<Planos />} />
          <Route path="integracoes" element={<Integracoes />} />
          <Route path="demonstracao" element={<Demonstracao />} />
          <Route path=":slug" element={<ProdutoPage />} />
          <Route path="*" element={<NaoEncontrada />} />
        </Route>
        <Route path="login" element={<Login />} />
        <Route path="portal" element={<Portal />} />
        <Route path="s" element={<SiteLayout />}>
          <Route index element={<SiteHome />} />
          <Route path="imoveis" element={<SiteBusca />} />
          <Route path="imovel/:id" element={<SiteImovel />} />
          <Route path="selecao/:id" element={<SiteSelecao />} />
          <Route path="blog" element={<SiteBlog />} />
          <Route path="pagina/:id" element={<SitePagina />} />
        </Route>
        <Route path="app" element={<Protegido><AppLayout /></Protegido>}>
          <Route index element={<Dashboard />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="funil" element={<Funil />} />
          <Route path="oportunidade/:id" element={<OportunidadeDetalhe />} />
          <Route path="leads" element={<Leads />} />
          <Route path="pessoas" element={<Pessoas />} />
          <Route path="propostas" element={<Propostas />} />
          <Route path="imoveis" element={<Imoveis />} />
          <Route path="chaves" element={<Chaves />} />
          <Route path="alugueis" element={<Contratos />} />
          <Route path="faturas" element={<Faturas />} />
          <Route path="repasses" element={<Repasses />} />
          <Route path="carteira" element={<Carteira />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="conciliacao" element={<Conciliacao />} />
          <Route path="dre" element={<DRE />} />
          <Route path="cadastros-financeiros" element={<CadastrosFinanceiros />} />
          <Route path="site" element={<EditorSite />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="ia" element={<IA />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>
      </Routes>
    </>
  )
}
