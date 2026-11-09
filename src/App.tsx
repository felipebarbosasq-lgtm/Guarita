import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ToastHost, notificar } from './components/ui'
import { aoFalharGravacao, iniciar, useSessao } from './lib/store'
import MarketingLayout from './marketing/MarketingLayout'
import Home from './marketing/Home'
import { Cadastro, Demonstracao, Integracoes, Login, NaoEncontrada, Planos, ProdutoPage } from './marketing/Paginas'
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

function Carregando() {
  return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-ink" aria-label="Carregando" /></div>
}

function Protegido({ children }: { children: ReactNode }) {
  const sessao = useSessao()
  const loc = useLocation()
  useEffect(() => { void iniciar() }, [])
  if (sessao.status === 'carregando') return <Carregando />
  if (sessao.status === 'anonimo') return <Navigate to={`/login?r=${encodeURIComponent(loc.pathname)}`} replace />
  return <>{children}</>
}

/** O site e o portal sem imobiliária na URL levam ao exemplo (ou ao site de quem está logado). */
function SemImobiliaria({ destino }: { destino: 's' | 'portal' }) {
  const sessao = useSessao()
  useEffect(() => { void iniciar() }, [])
  if (sessao.status === 'carregando') return <Carregando />
  return <Navigate to={`/${destino}/${sessao.imobiliaria?.slug ?? 'demo'}`} replace />
}

export default function App() {
  useEffect(() => aoFalharGravacao(m => notificar(`Não foi salvo: ${m}`)), [])
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
        <Route path="cadastro" element={<Cadastro />} />
        <Route path="portal" element={<SemImobiliaria destino="portal" />} />
        <Route path="portal/:slug" element={<Portal />} />
        <Route path="s" element={<SemImobiliaria destino="s" />} />
        <Route path="s/:slug" element={<SiteLayout />}>
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
