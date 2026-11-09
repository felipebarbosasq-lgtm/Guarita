import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import type { Banco } from './db.ts'
import type { Papel } from '../src/lib/types.ts'

const COOKIE = 'gm_sessao'
const DURACAO_MS = 1000 * 60 * 60 * 24 * 30 // 30 dias

export function gerarHashSenha(senha: string) {
  const sal = randomBytes(16)
  const hash = scryptSync(senha, sal, 64)
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`
}

export function conferirSenha(senha: string, guardado: string | null) {
  if (!guardado) return false
  const [alg, salB64, hashB64] = guardado.split('$')
  if (alg !== 'scrypt' || !salB64 || !hashB64) return false
  const esperado = Buffer.from(hashB64, 'base64')
  const calculado = scryptSync(senha, Buffer.from(salB64, 'base64'), esperado.length)
  return timingSafeEqual(esperado, calculado)
}

export function senhaValida(senha: unknown): senha is string {
  return typeof senha === 'string' && senha.length >= 8 && senha.length <= 200
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

export function criarSessao(db: Banco, req: Request, res: Response, usuarioId: string) {
  const token = randomBytes(32).toString('base64url')
  db.prepare('INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)').run(hashToken(token), usuarioId, Date.now() + DURACAO_MS)
  db.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(Date.now())
  const seguro = req.secure || req.get('x-forwarded-proto') === 'https'
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: seguro, maxAge: DURACAO_MS, path: '/' })
}

export function encerrarSessao(db: Banco, req: Request, res: Response) {
  const token = lerCookie(req, COOKIE)
  if (token) db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashToken(token))
  res.clearCookie(COOKIE, { path: '/' })
}

function lerCookie(req: Request, nome: string) {
  const bruto = req.headers.cookie
  if (!bruto) return undefined
  for (const parte of bruto.split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === nome) return decodeURIComponent(v.join('='))
  }
  return undefined
}

export interface Sessao { usuarioId: string; imobId: string; papel: Papel; email: string }

export function lerSessao(db: Banco, req: Request): Sessao | null {
  const token = lerCookie(req, COOKIE)
  if (!token) return null
  const linha = db.prepare(`
    SELECT c.usuario_id AS usuarioId, c.imobiliaria_id AS imobId, c.papel, c.email, c.ativo, s.expira_em AS expira
    FROM sessoes s JOIN credenciais c ON c.usuario_id = s.usuario_id
    WHERE s.token_hash = ?`).get(hashToken(token)) as (Sessao & { ativo: number; expira: number }) | undefined
  if (!linha || !linha.ativo || linha.expira < Date.now()) return null
  return { usuarioId: linha.usuarioId, imobId: linha.imobId, papel: linha.papel, email: linha.email }
}

declare module 'express-serve-static-core' {
  interface Request { sessao?: Sessao }
}

export function exigirLogin(db: Banco) {
  return (req: Request, res: Response, next: NextFunction) => {
    const s = lerSessao(db, req)
    if (!s) { res.status(401).json({ erro: 'Faça login para continuar.' }); return }
    req.sessao = s
    next()
  }
}

/** Limite simples de tentativas por chave (IP + e-mail, por exemplo), em memória. */
export function criarLimitador(maximo: number, janelaMs: number) {
  const tentativas = new Map<string, { n: number; ate: number }>()
  return {
    bloqueado(chave: string) {
      const t = tentativas.get(chave)
      if (!t || t.ate < Date.now()) return false
      return t.n >= maximo
    },
    registrar(chave: string) {
      const t = tentativas.get(chave)
      if (!t || t.ate < Date.now()) tentativas.set(chave, { n: 1, ate: Date.now() + janelaMs })
      else t.n++
      if (tentativas.size > 10000) for (const [k, v] of tentativas) if (v.ate < Date.now()) tentativas.delete(k)
    },
    limpar(chave: string) { tentativas.delete(chave) },
  }
}
