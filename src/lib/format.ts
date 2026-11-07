export const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const num = (v: number) => (v ?? 0).toLocaleString('pt-BR')
export const pct = (v: number) => `${(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

export const hoje = () => new Date().toISOString().slice(0, 10)
export const agoraISO = () => new Date().toISOString()

export function dataBR(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
export function dataHoraBR(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function addDias(iso: string, dias: number) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}
export function addMeses(iso: string, meses: number) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  const dia = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + meses)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(dia, ultimo))
  return d.toISOString().slice(0, 10)
}
export function diffDias(a: string, b: string) {
  return Math.round((new Date(a.slice(0, 10) + 'T12:00:00').getTime() - new Date(b.slice(0, 10) + 'T12:00:00').getTime()) / 86400000)
}
export function diffMeses(a: string, b: string) {
  const da = new Date(a.slice(0, 10) + 'T12:00:00'), dbb = new Date(b.slice(0, 10) + 'T12:00:00')
  return (da.getFullYear() - dbb.getFullYear()) * 12 + (da.getMonth() - dbb.getMonth())
}
export const competenciaDe = (iso: string) => iso.slice(0, 7)
export function competenciaBR(c: string) {
  const [y, m] = c.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1]}/${y}`
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const round2 = (v: number) => Math.round(v * 100) / 100

export function placeholderFoto(seed: string, label = '') {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const tons = ['#FFD400', '#F2C200', '#FFE14D', '#E6BE00']
  const bg = tons[h % tons.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520"><rect width="800" height="520" fill="${bg}"/><rect y="380" width="800" height="140" fill="#0A0A0A" opacity=".08"/><path d="M400 120 230 250v170h110V320h120v100h110V250z" fill="#0A0A0A"/><rect x="${300 + (h % 200)}" y="60" width="60" height="60" rx="30" fill="#fff" opacity=".6"/><text x="400" y="480" font-family="Arial" font-size="28" font-weight="700" fill="#0A0A0A" text-anchor="middle">${label}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export function downloadArquivo(nome: string, conteudo: string, tipo = 'text/plain') {
  const blob = new Blob([conteudo], { type: tipo + ';charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  URL.revokeObjectURL(a.href)
}
