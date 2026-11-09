import { useSyncExternalStore } from 'react'
import type { DB, Lancamento, Usuario } from './types'
import { aplicar, compactar, COLECOES, diff, type Op } from './sync'
import * as dom from './dominio'
import { uid } from './format'

/* ================= Comunicação com o servidor ================= */

export class ErroApi extends Error {
  status: number
  constructor(mensagem: string, status: number) { super(mensagem); this.status = status }
}

export async function api<T = unknown>(caminho: string, opcoes: { metodo?: string; corpo?: unknown; keepalive?: boolean } = {}): Promise<T> {
  const res = await fetch(caminho, {
    method: opcoes.metodo ?? (opcoes.corpo !== undefined ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', 'X-Cliente-Id': clienteId },
    body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
    credentials: 'same-origin',
    keepalive: opcoes.keepalive,
  })
  const dados = await res.json().catch(() => ({}))
  if (!res.ok) throw new ErroApi((dados as { erro?: string }).erro ?? 'Não foi possível falar com o servidor.', res.status)
  return dados as T
}

/** Identifica esta aba, para o servidor não devolver a ela as próprias alterações. */
const clienteId = uid()

/* ================= Estado local ================= */

function estadoVazio(): DB {
  const e = {} as Record<string, unknown>
  for (const c of COLECOES) e[c] = []
  e.site = { nome: '', slogan: '', corPrimaria: '#FFD400', corSecundaria: '#0A0A0A', fonte: 'Inter', whatsapp: '', email: '', endereco: '', sobre: '', marcaDagua: false, componentes: [], paginas: [], posts: [] }
  e.config = { roleta: { ativa: false, corretores: [], ponteiro: 0, apenasHorarioComercial: false }, regua: [], indices: { 'IGP-M': 0, IPCA: 0, INPC: 0, IVAR: 0 }, creditosIA: { usados: 0, limite: 0 }, webhooks: [] }
  e.analytics = { visitas: [] }
  return e as unknown as DB
}

let estado: DB = estadoVazio()
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach(l => l())

export function getDB() { return estado }

export function useDB<T>(sel: (db: DB) => T): T {
  return useSyncExternalStore(cb => { ouvintes.add(cb); return () => ouvintes.delete(cb) }, () => sel(estado))
}

/* ================= Sessão ================= */

export interface Sessao { status: 'carregando' | 'anonimo' | 'ok'; usuario?: Usuario; imobiliaria?: { id: string; slug: string; nome: string } }
let sessao: Sessao = { status: 'carregando' }
const ouvintesSessao = new Set<() => void>()
function definirSessao(s: Sessao) { sessao = s; ouvintesSessao.forEach(l => l()) }

export function useSessao() {
  return useSyncExternalStore(cb => { ouvintesSessao.add(cb); return () => ouvintesSessao.delete(cb) }, () => sessao)
}
export function getSessao() { return sessao }

type RespostaSessao = { usuario: Usuario; imobiliaria: { id: string; slug: string; nome: string } }

let iniciado: Promise<void> | null = null
/** Verifica se há sessão aberta e, se houver, carrega os dados. Pode ser chamada várias vezes. */
export function iniciar() {
  iniciado ??= (async () => {
    try { await abrir(await api<RespostaSessao>('/api/sessao')) }
    catch { definirSessao({ status: 'anonimo' }) }
  })()
  return iniciado
}

async function abrir(r: RespostaSessao) {
  estado = await api<DB>('/api/dados')
  avisar()
  definirSessao({ status: 'ok', ...r })
  abrirEventos()
}

export async function entrar(email: string, senha: string) {
  const r = await api<RespostaSessao>('/api/login', { corpo: { email, senha } })
  await abrir(r)
  iniciado = Promise.resolve()
}

export async function cadastrar(dados: { imobiliaria: string; nome: string; email: string; senha: string }) {
  const r = await api<RespostaSessao>('/api/cadastro', { corpo: dados })
  await abrir(r)
  iniciado = Promise.resolve()
}

export async function sair() {
  await enviarPendentes()
  await api('/api/logout', { corpo: {} }).catch(() => undefined)
  fecharEventos()
  estado = estadoVazio(); avisar()
  definirSessao({ status: 'anonimo' })
  iniciado = Promise.resolve()
}

async function recarregar() {
  try {
    const r = await api<RespostaSessao>('/api/sessao')
    estado = await api<DB>('/api/dados')
    pendentes = []
    avisar()
    definirSessao({ status: 'ok', ...r })
  } catch (e) {
    if (e instanceof ErroApi && e.status === 401) { fecharEventos(); definirSessao({ status: 'anonimo' }) }
  }
}

/* ================= Tempo real ================= */

let eventos: EventSource | null = null
function abrirEventos() {
  fecharEventos()
  eventos = new EventSource(`/api/eventos?cid=${clienteId}`)
  eventos.addEventListener('ops', ev => {
    const ops = JSON.parse((ev as MessageEvent).data) as Op[]
    const novo = structuredClone(estado)
    aplicar(novo, ops)
    aplicar(novo, pendentes) // o que ainda não foi enviado daqui continua valendo na tela
    estado = novo
    avisar()
  })
  eventos.addEventListener('recarregar', () => { void recarregar() })
  eventos.addEventListener('sair', () => { void sair() })
}
function fecharEventos() { eventos?.close(); eventos = null }

/* ================= Gravação ================= */

let pendentes: Op[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let envio: Promise<void> = Promise.resolve()
let avisoErro: ((m: string) => void) | null = null
/** Registra quem mostra os erros de gravação na tela. */
export function aoFalharGravacao(fn: (m: string) => void) { avisoErro = fn }

function enfileirar(ops: Op[]) {
  pendentes.push(...ops)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void enviarPendentes() }, 350)
}

export function enviarPendentes(keepalive = false) {
  if (timer) { clearTimeout(timer); timer = null }
  if (!pendentes.length) return envio
  const lote = compactar(pendentes)
  pendentes = []
  envio = envio.then(() => api('/api/ops', { corpo: { ops: lote }, keepalive }).then(() => undefined)).catch(async (e: unknown) => {
    avisoErro?.(e instanceof Error ? e.message : 'Não foi possível salvar.')
    await recarregar() // volta para o que está gravado no servidor
  })
  return envio
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { void enviarPendentes(true) })

/** Aplica uma alteração no estado, atualiza a tela na hora e manda as diferenças para o servidor. */
export function update(fn: (db: DB) => void) {
  const antes = estado
  const depois: DB = structuredClone(estado)
  fn(depois)
  const ops = diff(antes, depois)
  if (!ops.length) return
  estado = depois
  avisar()
  enfileirar(ops)
}

type ColecaoKey = typeof COLECOES[number]

export function salvarItem<K extends ColecaoKey>(col: K, item: DB[K][number]) {
  update(db => {
    const lista = db[col] as { id: string }[]
    const i = lista.findIndex(x => x.id === item.id)
    if (i >= 0) lista[i] = item
    else lista.unshift(item)
  })
}
export function removerItem<K extends ColecaoKey>(col: K, id: string) {
  update(db => { (db as unknown as Record<string, { id: string }[]>)[col] = (db[col] as { id: string }[]).filter(x => x.id !== id) })
}

/** Grava a senha de um usuário da equipe (só administradores). */
export async function definirSenhaUsuario(usuarioId: string, senha: string) {
  await enviarPendentes()
  await api(`/api/usuarios/${usuarioId}/senha`, { corpo: { senha } })
}

export async function restaurarBackup(dados: DB) {
  await enviarPendentes()
  await api('/api/restaurar', { corpo: { estado: dados } })
  await recarregar()
}

/* ================= Regras de negócio (ver dominio.ts) ================= */

export const valorFaturaContrato = dom.valorFaturaContrato
export const saldoConta = dom.saldoConta

export function capturarLead(dados: dom.DadosLead) {
  let id = ''
  update(db => { id = dom.capturarLeadEm(db, dados) })
  return id
}
export function gerarFaturas(competencia: string) {
  let n = 0
  update(db => { n = dom.gerarFaturasEm(db, competencia) })
  return n
}
export function baixarFatura(faturaId: string, data?: string, valorPago?: number) { update(db => dom.baixarFaturaEm(db, faturaId, data, valorPago)) }
export function antecipacaoGarantida() {
  let n = 0
  update(db => { n = dom.antecipacaoGarantidaEm(db) })
  return n
}
export function realizarRepasse(id: string) { update(db => dom.realizarRepasseEm(db, id)) }
export function executarRegua() {
  let n = 0
  update(db => { n = dom.executarReguaEm(db) })
  return n
}
export function aplicarReajuste(contratoId: string, percentual: number) { update(db => dom.aplicarReajusteEm(db, contratoId, percentual)) }
export function criarLancamentos(base: Omit<Lancamento, 'id' | 'parcela' | 'grupo'>, ocorrencias: number, modo: 'unico' | 'parcelado' | 'recorrente', addMesesFn: (d: string, n: number) => string) {
  update(db => dom.criarLancamentosEm(db, base, ocorrencias, modo, addMesesFn))
}

export function usarCreditoIA(): boolean {
  const c = estado.config.creditosIA
  if (c.usados >= c.limite) return false
  update(db => { db.config.creditosIA.usados++ })
  return true
}
