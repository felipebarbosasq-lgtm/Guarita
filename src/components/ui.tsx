import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Logo({ dark = false, to = '/' }: { dark?: boolean; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 select-none" aria-label="Guarita Mob">
      <svg viewBox="0 0 64 64" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill={dark ? '#FFD400' : '#0A0A0A'} />
        <path d="M32 12 12 28v24h14V38h12v14h14V28z" fill={dark ? '#0A0A0A' : '#FFD400'} />
      </svg>
      <span className={`font-display text-xl font-black tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>
        Guarita<span className={dark ? 'text-brand' : 'bg-brand px-1 ml-0.5 rounded'}>Mob</span>
      </span>
    </Link>
  )
}

export function PageHeader({ titulo, sub, acoes }: { titulo: string; sub?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black tracking-tight">{titulo}</h1>
        {sub && <p className="mt-1 text-sm text-ink-muted">{sub}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  )
}

export function Modal({ aberto, onFechar, titulo, children, largura = 'max-w-2xl' }: { aberto: boolean; onFechar: () => void; titulo: string; children: ReactNode; largura?: string }) {
  useEffect(() => {
    if (!aberto) return
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12" onMouseDown={onFechar}>
      <div className={`w-full ${largura} rounded-2xl bg-white shadow-2xl`} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal>
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-black">{titulo}</h2>
          <button className="rounded-lg p-1 text-2xl leading-none hover:bg-neutral-100" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function Campo({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="label">{label}</span>{children}</label>
}

export function Kpi({ titulo, valor, detalhe, destaque = false }: { titulo: string; valor: ReactNode; detalhe?: ReactNode; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${destaque ? 'border-ink bg-ink text-white' : 'border-neutral-200 bg-white'}`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${destaque ? 'text-brand' : 'text-ink-muted'}`}>{titulo}</div>
      <div className="mt-2 font-display text-2xl font-black">{valor}</div>
      {detalhe && <div className={`mt-1 text-xs ${destaque ? 'text-neutral-300' : 'text-ink-muted'}`}>{detalhe}</div>}
    </div>
  )
}

const cores: Record<string, string> = {
  verde: 'bg-green-100 text-green-800', vermelho: 'bg-red-100 text-red-800', amarelo: 'bg-brand-light text-ink', cinza: 'bg-neutral-100 text-neutral-700', preto: 'bg-ink text-brand', azul: 'bg-sky-100 text-sky-800',
}
export function Badge({ cor = 'cinza', children }: { cor?: keyof typeof cores | string; children: ReactNode }) {
  return <span className={`badge ${cores[cor] ?? cores.cinza}`}>{children}</span>
}

export function Vazio({ texto, acao }: { texto: string; acao?: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-neutral-200 p-10 text-center text-sm text-ink-muted">
      <p>{texto}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ abas, ativa, onChange }: { abas: { id: T; nome: string }[]; ativa: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-neutral-200">
      {abas.map(a => (
        <button key={a.id} onClick={() => onChange(a.id)} className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition ${ativa === a.id ? 'border-brand text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}>
          {a.nome}
        </button>
      ))}
    </div>
  )
}

export function Barra({ valor, max, rotulo, extra }: { valor: number; max: number; rotulo: string; extra?: string }) {
  const w = max > 0 ? Math.max(2, (valor / max) * 100) : 0
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-32 shrink-0 truncate text-ink-muted" title={rotulo}>{rotulo}</div>
      <div className="h-6 flex-1 rounded bg-neutral-100"><div className="h-6 rounded bg-brand" style={{ width: `${w}%` }} /></div>
      <div className="w-24 shrink-0 text-right font-semibold tabular-nums">{extra ?? valor}</div>
    </div>
  )
}

export function Toast({ msg, onClose }: { msg: string | null; onClose: () => void }) {
  useEffect(() => { if (msg) { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) } }, [msg, onClose])
  if (!msg) return null
  return <div className="fixed bottom-6 right-6 z-[60] max-w-sm rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl"><span className="mr-2 text-brand">●</span>{msg}</div>
}

let emitir: ((m: string) => void) | null = null
/** Mostra uma notificação rápida no canto da tela. */
export function notificar(msg: string) { emitir?.(msg) }
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { emitir = setMsg; return () => { emitir = null } }, [])
  return <Toast msg={msg} onClose={() => setMsg(null)} />
}
