import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { criarApp } from './index.ts'
import { aplicar, compactar, diff } from '../src/lib/sync.ts'
import { criarSeed } from '../src/lib/seed.ts'

let servidor: Server
let base = ''

before(async () => {
  const { app } = criarApp({ arquivoBanco: ':memory:', demo: true, cadastroAberto: true })
  servidor = app.listen(0)
  await new Promise(r => servidor.once('listening', r))
  base = `http://localhost:${(servidor.address() as AddressInfo).port}`
})
after(() => { servidor.close() })

/** Cliente HTTP simples que guarda o cookie de sessão. */
function cliente() {
  let cookie = ''
  return async (caminho: string, corpo?: unknown) => {
    const res = await fetch(base + caminho, {
      method: corpo === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    const sc = res.headers.get('set-cookie')
    if (sc) cookie = sc.split(';')[0]
    return { status: res.status, json: await res.json() as Record<string, any> }
  }
}

test('diff/aplicar reproduzem o estado, inclusive inserções no início', () => {
  const a = criarSeed()
  const b = structuredClone(a)
  b.imoveis.unshift({ ...b.imoveis[0], id: 'novo1' }, { ...b.imoveis[0], id: 'novo2' })
  b.imoveis.push({ ...b.imoveis[2], id: 'novo3' })
  b.pessoas = b.pessoas.filter(p => p.id !== 'p8')
  b.contratos[0].valorAluguel = 9999
  b.site.nome = 'Outro nome'
  const ops = diff(a, b)
  const c = structuredClone(a)
  aplicar(c, ops)
  assert.deepEqual(c, b)
  assert.equal(compactar([...ops, ...ops]).length, ops.length)
})

test('login exige senha correta', async () => {
  const c = cliente()
  assert.equal((await c('/api/login', { email: 'ana@guaritamob.com.br', senha: 'errada' })).status, 401)
  assert.equal((await c('/api/dados')).status, 401)
  const ok = await c('/api/login', { email: 'ana@guaritamob.com.br', senha: 'demo1234' })
  assert.equal(ok.status, 200)
  assert.equal(ok.json.usuario.papel, 'admin')
  assert.equal((await c('/api/dados')).json.imoveis.length, 7)
})

test('corretor não vê nem altera o financeiro', async () => {
  const c = cliente()
  await c('/api/login', { email: 'bruno@guaritamob.com.br', senha: 'demo1234' })
  const dados = (await c('/api/dados')).json
  assert.equal(dados.lancamentos.length, 0)
  assert.ok(dados.oportunidades.length > 0)
  assert.equal((await c('/api/ops', { ops: [{ t: 'delete', c: 'lancamentos', id: 'lc1' }] })).status, 403)
  assert.equal((await c('/api/ops', { ops: [{ t: 'upsert', c: 'usuarios', item: { id: 'x', nome: 'x', email: 'x@x.com', telefone: '', papel: 'admin', ativo: true } }] })).status, 403)
  // corretor pode girar a roleta, mas não desligá-la
  const config = { ...dados.config, roleta: { ...dados.config.roleta, ativa: false, ponteiro: 1 } }
  assert.equal((await c('/api/ops', { ops: [{ t: 'set', k: 'config', valor: config }] })).status, 200)
  const depois = (await c('/api/dados')).json.config.roleta
  assert.equal(depois.ativa, true)
  assert.equal(depois.ponteiro, 1)
})

test('cadastro cria imobiliária isolada das outras', async () => {
  const c = cliente()
  const r = await c('/api/cadastro', { imobiliaria: 'Imobiliária Teste', nome: 'Maria', email: 'maria@teste.com', senha: 'senhaforte1' })
  assert.equal(r.status, 201)
  assert.equal(r.json.imobiliaria.slug, 'imobiliaria-teste')
  const dados = (await c('/api/dados')).json
  assert.equal(dados.imoveis.length, 0)
  assert.equal(dados.usuarios.length, 1)
  assert.ok(dados.funis.length > 0 && dados.planoContas.length > 0)
  // não consegue sequestrar usuário de outra imobiliária pelo id
  const invasao = await c('/api/ops', { ops: [{ t: 'upsert', c: 'usuarios', item: { id: 'u2', nome: 'x', email: 'novo@x.com', telefone: '', papel: 'admin', ativo: true } }] })
  assert.equal(invasao.status, 400)
  // e-mail repetido é recusado
  assert.equal((await cliente()('/api/cadastro', { imobiliaria: 'Outra', nome: 'Zeca', email: 'MARIA@teste.com', senha: 'senhaforte1' })).status, 409)
})

test('admin cria usuário com senha e ele consegue entrar', async () => {
  const admin = cliente()
  await admin('/api/login', { email: 'maria@teste.com', senha: 'senhaforte1' })
  const novo = { id: 'novo-corretor-1', nome: 'João', email: 'joao@teste.com', telefone: '', papel: 'corretor', ativo: true }
  assert.equal((await admin('/api/ops', { ops: [{ t: 'upsert', c: 'usuarios', item: novo, pos: 'fim' }] })).status, 200)
  assert.equal((await admin(`/api/usuarios/${novo.id}/senha`, { senha: 'outrasenha1' })).status, 200)
  const joao = cliente()
  const r = await joao('/api/login', { email: 'joao@teste.com', senha: 'outrasenha1' })
  assert.equal(r.status, 200)
  assert.equal(r.json.imobiliaria.slug, 'imobiliaria-teste')
  // admin não pode tirar o próprio acesso
  const eu = (await admin('/api/sessao')).json.usuario
  assert.equal((await admin('/api/ops', { ops: [{ t: 'upsert', c: 'usuarios', item: { ...eu, papel: 'corretor' } }] })).status, 400)
  // desativar derruba a sessão
  await admin('/api/ops', { ops: [{ t: 'upsert', c: 'usuarios', item: { ...novo, ativo: false } }] })
  assert.equal((await joao('/api/dados')).status, 401)
})

test('lead enviado pelo site vira oportunidade distribuída pela roleta', async () => {
  const visitante = cliente()
  const site = (await visitante('/api/publico/demo')).json
  assert.ok(site.imoveis.length > 0)
  assert.equal(site.imoveis[0].proprietarioId, undefined, 'não expõe dados internos')
  assert.equal((await visitante('/api/publico/demo/lead', { nome: 'Visitante', telefone: '11 99999-0000', imovelId: 'i1' })).status, 201)
  const admin = cliente()
  await admin('/api/login', { email: 'ana@guaritamob.com.br', senha: 'demo1234' })
  const op = (await admin('/api/dados')).json.oportunidades.find((o: { titulo: string }) => o.titulo.startsWith('Visitante'))
  assert.ok(op)
  assert.ok(op.corretorId)
  assert.equal(op.origem, 'Site')
})

test('área do cliente pede CPF e e-mail juntos', async () => {
  const v = cliente()
  assert.equal((await v('/api/publico/demo/portal', { documento: '123.456.789-00', email: 'errado@x.com' })).status, 404)
  const r = await v('/api/publico/demo/portal', { documento: '12345678900', email: 'marcos@email.com' })
  assert.equal(r.status, 200)
  assert.equal(r.json.imoveis.length, 2)
})
