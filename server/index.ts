import express, { type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { abrirBanco, carregarEstado, gravarEstadoCompleto, gravarOps, transacao, type Banco } from './db.ts'
import { conferirSenha, criarLimitador, criarSessao, encerrarSessao, exigirLogin, gerarHashSenha, senhaValida } from './auth.ts'
import { ajustarConfig, filtrarEstado, validarOps } from './permissoes.ts'
import { avisarImobiliaria, avisarUsuario, conectar, transmitir } from './tempoReal.ts'
import { compactar, diff, type Op } from '../src/lib/sync.ts'
import { capturarLeadEm } from '../src/lib/dominio.ts'
import { criarBase, criarSeed } from '../src/lib/seed.ts'
import { agoraISO, dataBR, hoje, uid } from '../src/lib/format.ts'
import type { Config, DB, Papel, Usuario } from '../src/lib/types.ts'

export interface Opcoes { arquivoBanco: string; demo: boolean; cadastroAberto: boolean; pastaEstatica?: string }

export function criarApp(op: Opcoes) {
  const banco = abrirBanco(op.arquivoBanco)
  if (op.demo) criarDemo(banco)

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(express.json({ limit: '25mb' }))
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); next() })

  const limiteLogin = criarLimitador(8, 15 * 60 * 1000)
  const limitePublico = criarLimitador(30, 10 * 60 * 1000)
  const auth = exigirLogin(banco)
  const ip = (req: Request) => req.ip ?? 'ip'
  const erro = (res: Response, status: number, mensagem: string) => { res.status(status).json({ erro: mensagem }) }

  const imobPorSlug = (slug: string) => banco.prepare('SELECT id, slug, nome FROM imobiliarias WHERE slug = ?').get(slug) as { id: string; slug: string; nome: string } | undefined

  /** Carrega o estado, aplica a função, grava as diferenças e avisa as telas abertas. */
  function mutar<T>(imobId: string, fn: (estado: DB) => T): T {
    const { resultado, ops } = transacao(banco, () => {
      const antes = carregarEstado(banco, imobId)
      const depois = structuredClone(antes)
      const resultado = fn(depois)
      const ops = diff(antes, depois)
      if (ops.length) gravarOps(banco, imobId, ops)
      return { resultado, ops }
    })
    if (ops.length) transmitir(imobId, ops)
    return resultado
  }

  function dadosSessao(usuarioId: string) {
    const c = banco.prepare('SELECT c.usuario_id, c.imobiliaria_id, i.slug, i.nome FROM credenciais c JOIN imobiliarias i ON i.id = c.imobiliaria_id WHERE c.usuario_id = ?').get(usuarioId) as { usuario_id: string; imobiliaria_id: string; slug: string; nome: string }
    const estado = carregarEstado(banco, c.imobiliaria_id)
    const usuario = estado.usuarios.find(u => u.id === usuarioId)
    return { usuario, imobiliaria: { id: c.imobiliaria_id, slug: c.slug, nome: estado.site?.nome ?? c.nome } }
  }

  /* ---------------- Conta e sessão ---------------- */
  app.get('/api/saude', (_req, res) => { res.json({ ok: true }) })

  app.post('/api/cadastro', (req, res) => {
    if (!op.cadastroAberto) return erro(res, 403, 'O cadastro de novas imobiliárias está fechado.')
    if (limitePublico.bloqueado('cad:' + ip(req))) return erro(res, 429, 'Muitas tentativas. Tente de novo mais tarde.')
    limitePublico.registrar('cad:' + ip(req))
    const { imobiliaria, nome, email, senha } = req.body ?? {}
    if (!texto(imobiliaria, 2, 80) || !texto(nome, 2, 80) || !emailValido(email)) return erro(res, 400, 'Preencha o nome da imobiliária, o seu nome e um e-mail válido.')
    if (!senhaValida(senha)) return erro(res, 400, 'A senha precisa ter pelo menos 8 caracteres.')
    if (banco.prepare('SELECT 1 FROM credenciais WHERE email = ?').get(email)) return erro(res, 409, 'Já existe uma conta com este e-mail.')
    const imobId = uid()
    const admin: Usuario = { id: uid(), nome: nome.trim(), email: email.trim().toLowerCase(), telefone: '', papel: 'admin', ativo: true }
    transacao(banco, () => {
      banco.prepare('INSERT INTO imobiliarias (id, slug, nome, criado_em) VALUES (?, ?, ?, ?)').run(imobId, slugLivre(banco, imobiliaria), imobiliaria.trim(), agoraISO())
      banco.prepare('INSERT INTO credenciais (usuario_id, imobiliaria_id, email, senha_hash, papel, ativo) VALUES (?, ?, ?, ?, ?, 1)').run(admin.id, imobId, admin.email, gerarHashSenha(senha), 'admin')
      gravarEstadoCompleto(banco, imobId, criarBase(imobiliaria.trim(), admin))
    })
    criarSessao(banco, req, res, admin.id)
    res.status(201).json(dadosSessao(admin.id))
  })

  app.post('/api/login', (req, res) => {
    const { email, senha } = req.body ?? {}
    const chave = `${ip(req)}:${String(email).toLowerCase()}`
    if (limiteLogin.bloqueado(chave)) return erro(res, 429, 'Muitas tentativas. Aguarde alguns minutos.')
    const c = typeof email === 'string' ? banco.prepare('SELECT usuario_id, senha_hash, ativo FROM credenciais WHERE email = ?').get(email.trim()) as { usuario_id: string; senha_hash: string | null; ativo: number } | undefined : undefined
    if (!c || !c.ativo || typeof senha !== 'string' || !conferirSenha(senha, c.senha_hash)) {
      limiteLogin.registrar(chave)
      return erro(res, 401, 'E-mail ou senha incorretos.')
    }
    limiteLogin.limpar(chave)
    criarSessao(banco, req, res, c.usuario_id)
    res.json(dadosSessao(c.usuario_id))
  })

  app.post('/api/logout', (req, res) => { encerrarSessao(banco, req, res); res.json({ ok: true }) })

  app.get('/api/sessao', auth, (req, res) => { res.json(dadosSessao(req.sessao!.usuarioId)) })

  app.post('/api/minha-senha', auth, (req, res) => {
    const { atual, nova } = req.body ?? {}
    const c = banco.prepare('SELECT senha_hash FROM credenciais WHERE usuario_id = ?').get(req.sessao!.usuarioId) as { senha_hash: string | null }
    if (!conferirSenha(String(atual ?? ''), c.senha_hash)) return erro(res, 400, 'A senha atual está incorreta.')
    if (!senhaValida(nova)) return erro(res, 400, 'A nova senha precisa ter pelo menos 8 caracteres.')
    banco.prepare('UPDATE credenciais SET senha_hash = ? WHERE usuario_id = ?').run(gerarHashSenha(nova), req.sessao!.usuarioId)
    res.json({ ok: true })
  })

  app.post('/api/usuarios/:id/senha', auth, (req, res) => {
    if (req.sessao!.papel !== 'admin') return erro(res, 403, 'Só administradores definem senhas da equipe.')
    const { senha } = req.body ?? {}
    if (!senhaValida(senha)) return erro(res, 400, 'A senha precisa ter pelo menos 8 caracteres.')
    const r = banco.prepare('UPDATE credenciais SET senha_hash = ? WHERE usuario_id = ? AND imobiliaria_id = ?').run(gerarHashSenha(senha), String(req.params.id), req.sessao!.imobId)
    if (!r.changes) return erro(res, 404, 'Usuário não encontrado. Salve o usuário antes de definir a senha.')
    banco.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(String(req.params.id))
    res.json({ ok: true })
  })

  /* ---------------- Dados da imobiliária ---------------- */
  app.get('/api/dados', auth, (req, res) => {
    res.json(filtrarEstado(carregarEstado(banco, req.sessao!.imobId), req.sessao!.papel))
  })

  app.post('/api/ops', auth, (req, res) => {
    const { imobId, papel, usuarioId } = req.sessao!
    const ops = req.body?.ops as Op[]
    const problema = validarOps(ops, papel)
    if (problema) return erro(res, 403, problema)
    try {
      const aplicadas = transacao(banco, () => {
        const atual = carregarEstado(banco, imobId)
        const finais: Op[] = compactar(ops).map(o => o.t === 'set' && o.k === 'config' ? { ...o, valor: ajustarConfig(atual.config, o.valor as Config, papel) } : o)
        sincronizarCredenciais(banco, imobId, usuarioId, atual, finais)
        gravarOps(banco, imobId, finais)
        return finais
      })
      transmitir(imobId, aplicadas, String(req.get('x-cliente-id') ?? ''))
      for (const o of aplicadas) if (o.t !== 'set' && o.c === 'usuarios') avisarUsuario(imobId, o.t === 'upsert' ? o.item.id : o.id, 'recarregar')
      res.json({ ok: true })
    } catch (e) {
      erro(res, 400, e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  })

  app.post('/api/restaurar', auth, (req, res) => {
    const { imobId, papel } = req.sessao!
    if (papel !== 'admin') return erro(res, 403, 'Só administradores restauram backups.')
    const backup = req.body?.estado as DB | undefined
    if (!backup || !Array.isArray(backup.imoveis) || !backup.site || !backup.config) return erro(res, 400, 'Arquivo de backup inválido.')
    transacao(banco, () => {
      const atual = carregarEstado(banco, imobId)
      const base = criarSeed()
      const novo = { ...base, ...backup, usuarios: atual.usuarios } as DB // a equipe e os acessos atuais são mantidos
      gravarEstadoCompleto(banco, imobId, novo)
    })
    avisarImobiliaria(imobId, 'recarregar')
    res.json({ ok: true })
  })

  app.get('/api/eventos', auth, (req, res) => {
    const s = req.sessao!
    conectar(s.imobId, { res, papel: s.papel, usuarioId: s.usuarioId, clienteId: String(req.query.cid ?? '') })
  })

  /* ---------------- Rotas públicas (site da imobiliária, vitrine e área do cliente) ---------------- */
  app.get('/api/publico/:slug', (req, res) => {
    const imob = imobPorSlug(req.params.slug)
    if (!imob) return erro(res, 404, 'Imobiliária não encontrada.')
    const e = carregarEstado(banco, imob.id)
    res.json({
      slug: imob.slug, site: e.site,
      imoveis: e.imoveis.filter(i => i.publicadoSite && (i.status === 'disponivel' || i.status === 'reservado')).map(imovelPublico),
      equipe: e.usuarios.filter(u => u.ativo && u.papel !== 'financeiro').map(u => ({ id: u.id, nome: u.nome, telefone: u.telefone })),
      numeros: { imoveis: e.imoveis.filter(i => i.publicadoSite && i.status === 'disponivel').length, administrados: e.contratos.filter(c => c.status === 'ativo').length, equipe: e.usuarios.filter(u => u.ativo).length },
    })
  })

  app.post('/api/publico/:slug/lead', (req, res) => {
    const imob = imobPorSlug(req.params.slug)
    if (!imob) return erro(res, 404, 'Imobiliária não encontrada.')
    if (limitePublico.bloqueado('lead:' + ip(req))) return erro(res, 429, 'Muitos envios. Tente de novo mais tarde.')
    limitePublico.registrar('lead:' + ip(req))
    const { nome, email, telefone, mensagem, origem, imovelId } = req.body ?? {}
    if (!texto(nome, 2, 120) || (!texto(telefone, 6, 40) && !emailValido(email))) return erro(res, 400, 'Informe o nome e um telefone ou e-mail.')
    mutar(imob.id, e => capturarLeadEm(e, {
      nome: nome.trim(), email: typeof email === 'string' ? email.trim().slice(0, 120) : '', telefone: typeof telefone === 'string' ? telefone.trim().slice(0, 40) : '',
      mensagem: typeof mensagem === 'string' ? mensagem.slice(0, 2000) : undefined,
      origem: typeof origem === 'string' && origem.startsWith('Site') ? origem.slice(0, 40) : 'Site',
      imovelId: typeof imovelId === 'string' ? imovelId : undefined,
    }))
    res.status(201).json({ ok: true })
  })

  app.post('/api/publico/:slug/visita', (req, res) => {
    const imob = imobPorSlug(req.params.slug)
    if (!imob) return erro(res, 404, 'Imobiliária não encontrada.')
    const { pagina, imovelId } = req.body ?? {}
    if (!texto(pagina, 1, 120)) return erro(res, 400, 'Página inválida.')
    mutar(imob.id, e => {
      e.analytics ??= { visitas: [] }
      e.analytics.visitas.push({ data: hoje(), pagina, imovelId: typeof imovelId === 'string' ? imovelId : undefined })
      if (e.analytics.visitas.length > 20000) e.analytics.visitas.splice(0, 5000)
    })
    res.json({ ok: true })
  })

  app.get('/api/publico/:slug/selecao/:id', (req, res) => {
    const imob = imobPorSlug(req.params.slug)
    if (!imob) return erro(res, 404, 'Imobiliária não encontrada.')
    const e = carregarEstado(banco, imob.id)
    const o = e.oportunidades.find(o => o.id === req.params.id)
    if (!o) return erro(res, 404, 'Seleção não encontrada.')
    const pf = o.perfil
    const corretor = e.usuarios.find(u => u.id === o.corretorId)
    res.json({
      cliente: (e.pessoas.find(p => p.id === o.pessoaId)?.nome ?? '').split(' ')[0],
      corretor: corretor ? { nome: corretor.nome, telefone: corretor.telefone } : null,
      imoveis: e.imoveis.filter(i => i.publicadoSite && (i.status === 'disponivel' || i.status === 'reservado') && (!pf.finalidade || i.finalidade === pf.finalidade) && (!pf.tipo || i.tipo === pf.tipo) && (!pf.precoMax || i.preco <= pf.precoMax) && (!pf.quartosMin || i.quartos >= pf.quartosMin) && (!pf.bairro || i.bairro.toLowerCase().includes(pf.bairro.toLowerCase()))).map(imovelPublico),
    })
  })

  app.post('/api/publico/:slug/selecao/:id/visita', (req, res) => {
    const imob = imobPorSlug(req.params.slug)
    if (!imob) return erro(res, 404, 'Imobiliária não encontrada.')
    const { imovelId, data } = req.body ?? {}
    if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return erro(res, 400, 'Data inválida.')
    const ok = mutar(imob.id, e => {
      const o = e.oportunidades.find(o => o.id === req.params.id)
      const im = e.imoveis.find(i => i.id === imovelId)
      if (!o || !im) return false
      e.atividades.unshift({ id: uid(), oportunidadeId: o.id, tipo: 'visita', descricao: `Visita solicitada pelo cliente: ${im.codigo} em ${dataBR(data)}`, prazo: data, responsavelId: o.corretorId, concluida: false })
      o.atualizadoEm = hoje(); o.historico.unshift({ em: agoraISO(), texto: `Cliente pediu visita ao ${im.codigo} pela vitrine (${dataBR(data)})` })
      return true
    })
    if (!ok) return erro(res, 404, 'Seleção ou imóvel não encontrado.')
    res.status(201).json({ ok: true })
  })

  app.post('/api/publico/:slug/portal', (req, res) => {
    const imob = imobPorSlug(req.params.slug)
    if (!imob) return erro(res, 404, 'Imobiliária não encontrada.')
    const chave = 'portal:' + ip(req)
    if (limiteLogin.bloqueado(chave)) return erro(res, 429, 'Muitas tentativas. Aguarde alguns minutos.')
    const { documento, email } = req.body ?? {}
    const limpa = (s: unknown) => String(s ?? '').replace(/\D/g, '')
    const e = carregarEstado(banco, imob.id)
    const p = e.pessoas.find(p => limpa(p.documento) && limpa(p.documento) === limpa(documento) && p.email && p.email.toLowerCase() === String(email ?? '').trim().toLowerCase())
    if (!p) { limiteLogin.registrar(chave); return erro(res, 404, 'Cadastro não encontrado. Confira o CPF/CNPJ e o e-mail.') }
    const comoInq = e.contratos.filter(c => c.inquilinoId === p.id)
    const comoProp = e.contratos.filter(c => c.proprietarioId === p.id)
    const tituloImovel = (id: string) => e.imoveis.find(i => i.id === id)?.titulo ?? ''
    res.json({
      nome: p.nome,
      alugueis: comoInq.map(c => ({ codigo: c.codigo, imovel: tituloImovel(c.imovelId), diaVencimento: c.diaVencimento, indice: c.indice, faturas: e.faturas.filter(f => f.contratoId === c.id).sort((a, b) => b.competencia.localeCompare(a.competencia)).map(f => ({ id: f.id, competencia: f.competencia, vencimento: f.vencimento, valor: f.valor, status: f.status })) })),
      imoveis: comoProp.map(c => ({ codigo: c.codigo, imovel: tituloImovel(c.imovelId), valorAluguel: c.valorAluguel, status: c.status })),
      repasses: e.repasses.filter(r => r.proprietarioId === p.id).map(r => ({ id: r.id, contrato: e.contratos.find(c => c.id === r.contratoId)?.codigo, valorBruto: r.valorBruto, taxa: r.taxa, valorLiquido: r.valorLiquido, status: r.status, previsto: r.previsto, realizadoEm: r.realizadoEm })),
    })
  })

  app.use('/api', (_req, res) => erro(res, 404, 'Rota não encontrada.'))

  /* ---------------- Front-end (versão compilada) ---------------- */
  if (op.pastaEstatica && existsSync(op.pastaEstatica)) {
    app.use(express.static(op.pastaEstatica, { index: false, maxAge: '1h' }))
    app.get(/.*/, (_req, res) => res.sendFile(join(op.pastaEstatica!, 'index.html')))
  }

  return { app, banco }
}

/* ---------------- Auxiliares ---------------- */
function texto(v: unknown, min: number, max: number): v is string {
  return typeof v === 'string' && v.trim().length >= min && v.length <= max
}
function emailValido(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function imovelPublico(i: DB['imoveis'][number]) {
  const { proprietarioId: _p, chave: _c, portais: _po, ...resto } = i
  return resto
}

function slugLivre(banco: Banco, nome: string) {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'imobiliaria'
  let slug = base, n = 2
  while (banco.prepare('SELECT 1 FROM imobiliarias WHERE slug = ?').get(slug) || ['app', 'api', 'demo-admin'].includes(slug)) slug = `${base}-${n++}`
  return slug
}

/** Mantém a tabela de acesso (e-mail, papel, ativo) em dia com os usuários editados na tela de equipe. */
function sincronizarCredenciais(banco: Banco, imobId: string, quemEdita: string, atual: DB, ops: Op[]) {
  for (const o of ops) {
    if (o.t === 'set' || o.c !== 'usuarios') continue
    if (o.t === 'delete') {
      if (o.id === quemEdita) throw new Error('Você não pode excluir o seu próprio usuário.')
      banco.prepare('DELETE FROM credenciais WHERE usuario_id = ? AND imobiliaria_id = ?').run(o.id, imobId)
      continue
    }
    const u = o.item as Usuario
    if (!emailValido(u.email)) throw new Error('Informe um e-mail válido para o usuário.')
    if (!['admin', 'corretor', 'financeiro'].includes(u.papel)) throw new Error('Papel inválido.')
    if (u.id === quemEdita && (u.papel !== 'admin' || !u.ativo)) throw new Error('Você não pode remover o seu próprio acesso de administrador.')
    const dono = banco.prepare('SELECT usuario_id, imobiliaria_id FROM credenciais WHERE email = ?').get(u.email.trim()) as { usuario_id: string; imobiliaria_id: string } | undefined
    if (dono && dono.usuario_id !== u.id) throw new Error('Este e-mail já está em uso por outro usuário.')
    const existe = banco.prepare('SELECT imobiliaria_id FROM credenciais WHERE usuario_id = ?').get(u.id) as { imobiliaria_id: string } | undefined
    if (existe && existe.imobiliaria_id !== imobId) throw new Error('Usuário inválido.')
    if (existe) banco.prepare('UPDATE credenciais SET email = ?, papel = ?, ativo = ? WHERE usuario_id = ?').run(u.email.trim().toLowerCase(), u.papel as Papel, u.ativo ? 1 : 0, u.id)
    else banco.prepare('INSERT INTO credenciais (usuario_id, imobiliaria_id, email, senha_hash, papel, ativo) VALUES (?, ?, ?, NULL, ?, ?)').run(u.id, imobId, u.email.trim().toLowerCase(), u.papel, u.ativo ? 1 : 0)
    if (!u.ativo) banco.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(u.id)
  }
  void atual
}

/** Imobiliária de demonstração com dados de exemplo (senha de todos: demo1234). */
function criarDemo(banco: Banco) {
  if (banco.prepare("SELECT 1 FROM imobiliarias WHERE slug = 'demo'").get()) return
  const estado = criarSeed()
  const imobId = uid()
  transacao(banco, () => {
    banco.prepare('INSERT INTO imobiliarias (id, slug, nome, criado_em) VALUES (?, ?, ?, ?)').run(imobId, 'demo', estado.site.nome, agoraISO())
    const hash = gerarHashSenha('demo1234')
    for (const u of estado.usuarios) banco.prepare('INSERT INTO credenciais (usuario_id, imobiliaria_id, email, senha_hash, papel, ativo) VALUES (?, ?, ?, ?, ?, 1)').run(u.id, imobId, u.email, hash, u.papel)
    gravarEstadoCompleto(banco, imobId, estado)
  })
  console.log('Imobiliária de demonstração criada em /s/demo — logins com senha demo1234:', estado.usuarios.map(u => u.email).join(', '))
}

/* ---------------- Inicialização ---------------- */
const executadoDireto = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
if (executadoDireto) {
  const pastaDados = process.env.DATA_DIR ?? resolve('data')
  const { app } = criarApp({
    arquivoBanco: join(pastaDados, 'guarita-mob.db'),
    demo: process.env.SEED_DEMO === '1',
    cadastroAberto: process.env.ALLOW_SIGNUP !== '0',
    pastaEstatica: resolve('dist'),
  })
  const porta = Number(process.env.PORT ?? 3001)
  app.listen(porta, () => console.log(`Guarita Mob rodando em http://localhost:${porta}`))
}
