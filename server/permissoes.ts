import type { Config, DB, Papel } from '../src/lib/types.ts'
import { COLECOES, DOCUMENTOS, ehColecao, ehDocumento, type Colecao, type Documento, type Op } from '../src/lib/sync.ts'

const TODOS: Papel[] = ['admin', 'corretor', 'financeiro']
const GESTAO: Papel[] = ['admin', 'financeiro']

/** Quem pode ver cada parte dos dados. */
const leitura: Record<Colecao | Documento, Papel[]> = {
  usuarios: TODOS, pessoas: TODOS, imoveis: TODOS, funis: TODOS, oportunidades: TODOS, atividades: TODOS, propostas: TODOS,
  contratos: TODOS, faturas: TODOS, repasses: TODOS,
  planoContas: GESTAO, centrosCusto: GESTAO, contasBancarias: GESTAO, lancamentos: GESTAO,
  site: TODOS, config: TODOS, analytics: TODOS,
}

/** Quem pode alterar cada parte dos dados. */
const escrita: Record<Colecao | Documento, Papel[]> = {
  usuarios: ['admin'],
  pessoas: TODOS, imoveis: TODOS, funis: ['admin', 'corretor'], oportunidades: TODOS, atividades: TODOS, propostas: TODOS,
  contratos: GESTAO, faturas: GESTAO, repasses: GESTAO,
  planoContas: GESTAO, centrosCusto: GESTAO, contasBancarias: GESTAO, lancamentos: GESTAO,
  site: ['admin', 'corretor'],
  config: TODOS, // não-administradores só mexem no ponteiro da roleta e nos créditos de IA (ver ajustarConfig)
  analytics: [],
}

export const podeLer = (papel: Papel, alvo: Colecao | Documento) => leitura[alvo].includes(papel)
export const podeEscrever = (papel: Papel, alvo: Colecao | Documento) => escrita[alvo].includes(papel)

/** Remove do estado o que o papel não pode ver. */
export function filtrarEstado(estado: DB, papel: Papel): DB {
  const copia = { ...estado } as Record<string, unknown>
  for (const c of COLECOES) if (!podeLer(papel, c)) copia[c] = []
  for (const k of DOCUMENTOS) if (!podeLer(papel, k)) copia[k] = k === 'analytics' ? { visitas: [] } : copia[k]
  return copia as unknown as DB
}

export function filtrarOps(ops: Op[], papel: Papel) {
  return ops.filter(o => podeLer(papel, o.t === 'set' ? o.k : o.c))
}

const LIMITE_ITEM = 12 * 1024 * 1024

/** Valida o formato das operações e as permissões. Devolve uma mensagem de erro ou null. */
export function validarOps(ops: unknown, papel: Papel): string | null {
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 2000) return 'Lista de operações inválida.'
  for (const o of ops as Record<string, unknown>[]) {
    if (!o || typeof o !== 'object') return 'Operação inválida.'
    if (o.t === 'set') {
      if (!ehDocumento(o.k) || o.k === 'analytics') return 'Documento inválido.'
      if (!podeEscrever(papel, o.k)) return 'Sem permissão para alterar estes dados.'
      if (typeof o.valor !== 'object' || o.valor === null) return 'Valor inválido.'
      continue
    }
    if (o.t !== 'upsert' && o.t !== 'delete') return 'Tipo de operação inválido.'
    if (!ehColecao(o.c)) return 'Coleção inválida.'
    if (!podeEscrever(papel, o.c)) return 'Sem permissão para alterar estes dados.'
    if (o.t === 'delete') { if (typeof o.id !== 'string' || !o.id) return 'Identificador inválido.'; continue }
    const item = o.item as { id?: unknown } | null
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > 64) return 'Registro inválido.'
    if (o.pos !== undefined && o.pos !== 'inicio' && o.pos !== 'fim') return 'Posição inválida.'
    if (JSON.stringify(item).length > LIMITE_ITEM) return 'Registro grande demais (reduza o tamanho das fotos).'
  }
  return null
}

/** Para quem não é administrador, a configuração só aceita mudança no ponteiro da roleta e nos créditos de IA. */
export function ajustarConfig(atual: Config, nova: Config, papel: Papel): Config {
  if (papel === 'admin') return nova
  return {
    ...atual,
    roleta: { ...atual.roleta, ponteiro: Number(nova?.roleta?.ponteiro) || 0 },
    creditosIA: { ...atual.creditosIA, usados: Math.max(atual.creditosIA.usados, Number(nova?.creditosIA?.usados) || 0) },
  }
}
