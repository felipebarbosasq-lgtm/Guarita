/**
 * Sincronização entre o navegador e o servidor.
 *
 * O estado da imobiliária é um objeto `DB` com coleções (listas de registros com `id`)
 * e documentos únicos (site, config, analytics). Cada alteração vira uma lista de
 * operações pequenas, por registro, que o servidor grava e repassa às outras telas abertas.
 */
import type { DB } from './types.ts'

export const COLECOES = [
  'usuarios', 'pessoas', 'imoveis', 'funis', 'oportunidades', 'atividades', 'propostas', 'contratos',
  'faturas', 'repasses', 'planoContas', 'centrosCusto', 'contasBancarias', 'lancamentos',
] as const
export type Colecao = typeof COLECOES[number]

export const DOCUMENTOS = ['site', 'config', 'analytics'] as const
export type Documento = typeof DOCUMENTOS[number]

type Registro = { id: string }

export type Op =
  | { t: 'upsert'; c: Colecao; item: Registro; pos?: 'inicio' | 'fim' }
  | { t: 'delete'; c: Colecao; id: string }
  | { t: 'set'; k: Documento; valor: unknown }

export const ehColecao = (c: unknown): c is Colecao => typeof c === 'string' && (COLECOES as readonly string[]).includes(c)
export const ehDocumento = (k: unknown): k is Documento => typeof k === 'string' && (DOCUMENTOS as readonly string[]).includes(k)

/** Compara dois estados e devolve as operações que levam de `antes` a `depois`. */
export function diff(antes: DB, depois: DB): Op[] {
  const ops: Op[] = []
  for (const c of COLECOES) {
    const a = antes[c] as Registro[], d = depois[c] as Registro[]
    if (a === d) continue
    const mapaA = new Map(a.map(x => [x.id, x]))
    const idsD = new Set<string>()
    // Itens novos no começo da lista (inseridos com unshift) vão para o início, em ordem inversa,
    // para que inserir um a um no início reproduza a mesma ordem
    let prefixo = 0
    while (prefixo < d.length && !mapaA.has(d[prefixo].id)) prefixo++
    if (prefixo === d.length) prefixo = a.length === 0 ? 0 : prefixo
    for (let i = prefixo - 1; i >= 0; i--) ops.push({ t: 'upsert', c, item: d[i], pos: 'inicio' })
    d.forEach((item, i) => {
      idsD.add(item.id)
      if (i < prefixo) return
      const velho = mapaA.get(item.id)
      if (!velho) ops.push({ t: 'upsert', c, item, pos: 'fim' })
      else if (velho !== item && JSON.stringify(velho) !== JSON.stringify(item)) ops.push({ t: 'upsert', c, item })
    })
    for (const x of a) if (!idsD.has(x.id)) ops.push({ t: 'delete', c, id: x.id })
  }
  for (const k of DOCUMENTOS) {
    if (antes[k] !== depois[k] && JSON.stringify(antes[k]) !== JSON.stringify(depois[k])) ops.push({ t: 'set', k, valor: depois[k] })
  }
  return ops
}

/** Aplica operações num estado (muta o objeto recebido). */
export function aplicar(db: DB, ops: Op[]) {
  for (const op of ops) {
    if (op.t === 'set') { (db as unknown as Record<string, unknown>)[op.k] = op.valor; continue }
    const lista = db[op.c] as Registro[]
    const i = lista.findIndex(x => x.id === (op.t === 'upsert' ? op.item.id : op.id))
    if (op.t === 'delete') { if (i >= 0) lista.splice(i, 1); continue }
    if (i >= 0) lista[i] = op.item
    else if (op.pos === 'inicio') lista.unshift(op.item)
    else lista.push(op.item)
  }
}

/** Junta operações repetidas sobre o mesmo registro, mantendo só a última (e a posição da primeira inserção). */
export function compactar(ops: Op[]): Op[] {
  const chave = (o: Op) => o.t === 'set' ? `d:${o.k}` : `c:${o.c}:${o.t === 'upsert' ? o.item.id : o.id}`
  const ultimo = new Map<string, Op>()
  const posInicial = new Map<string, 'inicio' | 'fim'>()
  for (const o of ops) {
    const k = chave(o)
    if (o.t === 'upsert' && o.pos && !posInicial.has(k)) posInicial.set(k, o.pos)
    ultimo.delete(k)
    ultimo.set(k, o)
  }
  return [...ultimo.entries()].map(([k, o]) => o.t === 'upsert' && posInicial.has(k) ? { ...o, pos: posInicial.get(k) } : o)
}
