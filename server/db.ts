import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { DB } from '../src/lib/types.ts'
import { COLECOES, DOCUMENTOS, type Op } from '../src/lib/sync.ts'

export type Banco = DatabaseSync

export function abrirBanco(caminho: string): Banco {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true })
  const db = new DatabaseSync(caminho)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS imobiliarias (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      criado_em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS credenciais (
      usuario_id TEXT PRIMARY KEY,
      imobiliaria_id TEXT NOT NULL REFERENCES imobiliarias(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      senha_hash TEXT,
      papel TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sessoes (
      token_hash TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES credenciais(usuario_id) ON DELETE CASCADE,
      expira_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS registros (
      imobiliaria_id TEXT NOT NULL REFERENCES imobiliarias(id) ON DELETE CASCADE,
      colecao TEXT NOT NULL,
      id TEXT NOT NULL,
      pos REAL NOT NULL,
      dados TEXT NOT NULL,
      atualizado_em TEXT NOT NULL,
      PRIMARY KEY (imobiliaria_id, colecao, id)
    );
    CREATE INDEX IF NOT EXISTS registros_ordem ON registros(imobiliaria_id, colecao, pos);
    CREATE TABLE IF NOT EXISTS documentos (
      imobiliaria_id TEXT NOT NULL REFERENCES imobiliarias(id) ON DELETE CASCADE,
      chave TEXT NOT NULL,
      dados TEXT NOT NULL,
      PRIMARY KEY (imobiliaria_id, chave)
    );
  `)
  return db
}

/** Executa `fn` numa transação; desfaz tudo se der erro. */
export function transacao<T>(db: Banco, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

/** Monta o estado completo de uma imobiliária a partir das tabelas. */
export function carregarEstado(db: Banco, imobId: string): DB {
  const estado = {} as Record<string, unknown>
  for (const c of COLECOES) estado[c] = []
  const linhas = db.prepare('SELECT colecao, dados FROM registros WHERE imobiliaria_id = ? ORDER BY colecao, pos').all(imobId) as { colecao: string; dados: string }[]
  for (const l of linhas) (estado[l.colecao] as unknown[] | undefined)?.push(JSON.parse(l.dados))
  const docs = db.prepare('SELECT chave, dados FROM documentos WHERE imobiliaria_id = ?').all(imobId) as { chave: string; dados: string }[]
  for (const d of docs) estado[d.chave] = JSON.parse(d.dados)
  return estado as unknown as DB
}

/** Grava operações já validadas. */
export function gravarOps(db: Banco, imobId: string, ops: Op[]) {
  const agora = new Date().toISOString()
  const existe = db.prepare('SELECT pos FROM registros WHERE imobiliaria_id = ? AND colecao = ? AND id = ?')
  const extremos = db.prepare('SELECT MIN(pos) AS min, MAX(pos) AS max FROM registros WHERE imobiliaria_id = ? AND colecao = ?')
  const inserir = db.prepare('INSERT INTO registros (imobiliaria_id, colecao, id, pos, dados, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)')
  const atualizar = db.prepare('UPDATE registros SET dados = ?, atualizado_em = ? WHERE imobiliaria_id = ? AND colecao = ? AND id = ?')
  const apagar = db.prepare('DELETE FROM registros WHERE imobiliaria_id = ? AND colecao = ? AND id = ?')
  const salvarDoc = db.prepare('INSERT INTO documentos (imobiliaria_id, chave, dados) VALUES (?, ?, ?) ON CONFLICT(imobiliaria_id, chave) DO UPDATE SET dados = excluded.dados')
  for (const op of ops) {
    if (op.t === 'set') { salvarDoc.run(imobId, op.k, JSON.stringify(op.valor)); continue }
    if (op.t === 'delete') { apagar.run(imobId, op.c, op.id); continue }
    const dados = JSON.stringify(op.item)
    if (existe.get(imobId, op.c, op.item.id)) { atualizar.run(dados, agora, imobId, op.c, op.item.id); continue }
    const e = extremos.get(imobId, op.c) as { min: number | null; max: number | null }
    const pos = op.pos === 'inicio' ? (e.min ?? 0) - 1 : (e.max ?? 0) + 1
    inserir.run(imobId, op.c, op.item.id, pos, dados, agora)
  }
}

/** Grava um estado inteiro (usado ao criar uma imobiliária ou restaurar um backup). */
export function gravarEstadoCompleto(db: Banco, imobId: string, estado: DB) {
  db.prepare('DELETE FROM registros WHERE imobiliaria_id = ?').run(imobId)
  const ops: Op[] = []
  for (const c of COLECOES) for (const item of (estado[c] as { id: string }[]) ?? []) ops.push({ t: 'upsert', c, item, pos: 'fim' })
  for (const k of DOCUMENTOS) ops.push({ t: 'set', k, valor: estado[k] })
  gravarOps(db, imobId, ops)
}
