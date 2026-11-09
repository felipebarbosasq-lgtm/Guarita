import { useState, type FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Campo, Logo, Modal, notificar } from '../components/ui'
import { api, sair as encerrar, useDB, useSessao } from '../lib/store'
import type { Papel } from '../lib/types'

export function useUsuarioAtual() {
  const sessao = useSessao()
  const usuarios = useDB(d => d.usuarios)
  return usuarios.find(u => u.id === sessao.usuario?.id) ?? sessao.usuario!
}

export function useSlug() {
  return useSessao().imobiliaria?.slug ?? 'demo'
}

function TrocarSenha({ onFechar }: { onFechar: () => void }) {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [erro, setErro] = useState('')
  const enviar = async (e: FormEvent) => {
    e.preventDefault(); setErro('')
    try { await api('/api/minha-senha', { corpo: { atual, nova } }); notificar('Senha alterada'); onFechar() } catch (x) { setErro(x instanceof Error ? x.message : 'Erro') }
  }
  return (
    <Modal aberto onFechar={onFechar} titulo="Alterar minha senha" largura="max-w-md">
      <form onSubmit={enviar} className="space-y-4">
        <Campo label="Senha atual"><input type="password" className="input" required autoComplete="current-password" value={atual} onChange={e => setAtual(e.target.value)} /></Campo>
        <Campo label="Nova senha (mínimo 8)"><input type="password" className="input" required minLength={8} autoComplete="new-password" value={nova} onChange={e => setNova(e.target.value)} /></Campo>
        {erro && <p className="text-sm font-semibold text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary">Salvar</button></div>
      </form>
    </Modal>
  )
}

const menu: { grupo: string; itens: { to: string; nome: string; papeis?: Papel[] }[] }[] = [
  { grupo: 'Geral', itens: [{ to: '/app', nome: 'Painel' }, { to: '/app/agenda', nome: 'Agenda e atividades' }] },
  { grupo: 'CRM', itens: [{ to: '/app/funil', nome: 'Funil de vendas' }, { to: '/app/leads', nome: 'Leads e roleta' }, { to: '/app/pessoas', nome: 'Pessoas' }, { to: '/app/propostas', nome: 'Propostas' }, { to: '/app/imoveis', nome: 'Imóveis' }, { to: '/app/chaves', nome: 'Chaves' }] },
  { grupo: 'Locação', itens: [{ to: '/app/alugueis', nome: 'Contratos' }, { to: '/app/faturas', nome: 'Faturas e cobrança' }, { to: '/app/repasses', nome: 'Repasses' }, { to: '/app/carteira', nome: 'Carteira e DIMOB' }] },
  { grupo: 'Financeiro', itens: [{ to: '/app/financeiro', nome: 'Contas a pagar/receber', papeis: ['admin', 'financeiro'] }, { to: '/app/conciliacao', nome: 'Conciliação bancária', papeis: ['admin', 'financeiro'] }, { to: '/app/dre', nome: 'DRE gerencial', papeis: ['admin', 'financeiro'] }, { to: '/app/cadastros-financeiros', nome: 'Plano de contas', papeis: ['admin', 'financeiro'] }] },
  { grupo: 'Marketing', itens: [{ to: '/app/site', nome: 'Editor do site' }, { to: '/app/analytics', nome: 'Analytics do site' }, { to: '/app/ia', nome: 'Guarita IA' }] },
  { grupo: 'Administração', itens: [{ to: '/app/equipe', nome: 'Equipe e permissões', papeis: ['admin'] }, { to: '/app/configuracoes', nome: 'Configurações', papeis: ['admin'] }] },
]

export default function AppLayout() {
  const usuario = useUsuarioAtual()
  const sessao = useSessao()
  const nav = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState(false)
  const sair = async () => { await encerrar(); nav('/login') }
  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="px-5 py-5"><Logo dark to="/app" /><div className="mt-2 truncate text-xs font-semibold text-neutral-400">{sessao.imobiliaria?.nome}</div></div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {menu.map(g => {
          const itens = g.itens.filter(i => !i.papeis || i.papeis.includes(usuario?.papel))
          if (!itens.length) return null
          return (
            <div key={g.grupo} className="mt-4">
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-neutral-500">{g.grupo}</div>
              {itens.map(i => (
                <NavLink key={i.to} to={i.to} end={i.to === '/app'} onClick={() => setAberto(false)}
                  className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-brand text-ink' : 'text-neutral-300 hover:bg-white/10 hover:text-white'}`}>
                  {i.nome}
                </NavLink>
              ))}
            </div>
          )
        })}
      </div>
      <div className="border-t border-white/10 p-4 text-sm">
        <div className="font-semibold text-white">{usuario?.nome}</div>
        <div className="text-xs capitalize text-neutral-400">{usuario?.papel}</div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => void sair()} className="rounded-md bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20">Sair</button>
          <button onClick={() => setSenha(true)} className="rounded-md bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20">Minha senha</button>
          <a href={`/s/${sessao.imobiliaria?.slug}`} target="_blank" rel="noreferrer" className="rounded-md bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20">Meu site ↗</a>
        </div>
      </div>
    </nav>
  )
  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-ink lg:block">{sidebar}</aside>
      {aberto && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setAberto(false)}><aside className="h-full w-64 bg-ink" onClick={e => e.stopPropagation()}>{sidebar}</aside></div>}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden">
          <button onClick={() => setAberto(true)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold">☰ Menu</button>
          <Logo to="/app" />
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
        {senha && <TrocarSenha onFechar={() => setSenha(false)} />}
      </div>
    </div>
  )
}
