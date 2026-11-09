import type { Response } from 'express'
import type { Papel } from '../src/lib/types.ts'
import type { Op } from '../src/lib/sync.ts'
import { filtrarOps } from './permissoes.ts'

interface Conexao { res: Response; papel: Papel; usuarioId: string; clienteId: string }

/** Conexões abertas (Server-Sent Events) por imobiliária, para avisar as outras telas das mudanças. */
const conexoes = new Map<string, Set<Conexao>>()

export function conectar(imobId: string, conexao: Conexao) {
  const { res } = conexao
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.write('retry: 3000\n\n')
  if (!conexoes.has(imobId)) conexoes.set(imobId, new Set())
  conexoes.get(imobId)!.add(conexao)
  const pulso = setInterval(() => res.write(': ping\n\n'), 25000)
  res.on('close', () => { clearInterval(pulso); conexoes.get(imobId)?.delete(conexao) })
}

export function transmitir(imobId: string, ops: Op[], origemClienteId?: string) {
  for (const c of conexoes.get(imobId) ?? []) {
    if (c.clienteId === origemClienteId) continue
    const visiveis = filtrarOps(ops, c.papel)
    if (visiveis.length) c.res.write(`event: ops\ndata: ${JSON.stringify(visiveis)}\n\n`)
  }
}

/** Pede para as telas de um usuário recarregarem (ex.: papel alterado) ou saírem. */
export function avisarUsuario(imobId: string, usuarioId: string, evento: 'recarregar' | 'sair') {
  for (const c of conexoes.get(imobId) ?? []) if (c.usuarioId === usuarioId) c.res.write(`event: ${evento}\ndata: {}\n\n`)
}

export function avisarImobiliaria(imobId: string, evento: 'recarregar') {
  for (const c of conexoes.get(imobId) ?? []) c.res.write(`event: ${evento}\ndata: {}\n\n`)
}
