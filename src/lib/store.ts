import { useSyncExternalStore } from 'react'
import type { Contrato, DB, Fatura, Lancamento, Oportunidade, Pessoa } from './types'
import { criarSeed } from './seed'
import { addDias, agoraISO, competenciaDe, diffDias, hoje, round2, uid } from './format'

const CHAVE = 'guarita-mob-db-v1'

function carregar(): DB {
  try {
    const raw = localStorage.getItem(CHAVE)
    if (raw) return { ...criarSeed(), ...JSON.parse(raw) }
  } catch { /* ignora */ }
  return criarSeed()
}

let estado: DB = carregar()
const ouvintes = new Set<() => void>()

// Mantém abas e a prévia do site (iframe) sincronizadas quando outra janela altera os dados
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== CHAVE) return
    estado = carregar()
    ouvintes.forEach(l => l())
  })
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)) } catch { /* armazenamento indisponível */ }
}

export function getDB() { return estado }

/** Aplica uma alteração imutável no banco e notifica a interface. */
export function update(fn: (db: DB) => void) {
  const copia: DB = structuredClone(estado)
  fn(copia)
  estado = copia
  salvar()
  ouvintes.forEach(l => l())
}

export function resetarDemo() {
  estado = criarSeed()
  salvar()
  ouvintes.forEach(l => l())
}

export function useDB<T>(sel: (db: DB) => T): T {
  return useSyncExternalStore(cb => { ouvintes.add(cb); return () => ouvintes.delete(cb) }, () => sel(estado))
}

type ColecaoKey = { [K in keyof DB]: DB[K] extends { id: string }[] ? K : never }[keyof DB]

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

/* ---------------- Regras de negócio ---------------- */

/** Próximo corretor da roleta (round-robin entre os corretores selecionados e ativos). */
export function proximoCorretorRoleta(db: DB): string | undefined {
  const r = db.config.roleta
  const ativos = r.corretores.filter(id => db.usuarios.find(u => u.id === id && u.ativo))
  if (!r.ativa || ativos.length === 0) return undefined
  const escolhido = ativos[r.ponteiro % ativos.length]
  r.ponteiro = (r.ponteiro + 1) % ativos.length
  return escolhido
}

/** Captura um lead vindo de qualquer canal (site, portal, WhatsApp...) e cria a oportunidade no CRM. */
export function capturarLead(dados: { nome: string; email: string; telefone: string; mensagem?: string; origem: string; imovelId?: string }) {
  let opId = ''
  update(db => {
    let pessoa = db.pessoas.find(p => (dados.email && p.email === dados.email) || (dados.telefone && p.telefone === dados.telefone))
    if (!pessoa) {
      pessoa = { id: uid(), nome: dados.nome, email: dados.email, telefone: dados.telefone, documento: '', tipos: ['cliente'], criadoEm: hoje() } as Pessoa
      db.pessoas.unshift(pessoa)
    }
    const imovel = db.imoveis.find(i => i.id === dados.imovelId)
    const funil = imovel?.finalidade === 'aluguel' ? db.funis.find(f => f.nome.toLowerCase().includes('loca')) ?? db.funis[0] : db.funis[0]
    const corretorId = proximoCorretorRoleta(db)
    const op: Oportunidade = {
      id: uid(), titulo: `${dados.nome}${imovel ? ' — ' + imovel.codigo : ''}`, pessoaId: pessoa.id, funilId: funil.id, etapaId: funil.etapas[0].id,
      corretorId, imovelId: imovel?.id, origem: dados.origem, valor: imovel?.preco ?? 0, status: 'aberta', criadoEm: hoje(), atualizadoEm: hoje(),
      perfil: imovel ? { finalidade: imovel.finalidade, tipo: imovel.tipo, bairro: imovel.bairro, precoMax: imovel.preco * 1.15 } : {},
      historico: [{ em: agoraISO(), texto: `Lead recebido via ${dados.origem}${corretorId ? ' e distribuído pela roleta' : ''}.${dados.mensagem ? ' Mensagem: ' + dados.mensagem : ''}` }],
    }
    db.oportunidades.unshift(op)
    db.atividades.unshift({ id: uid(), oportunidadeId: op.id, tipo: 'ligacao', descricao: `Primeiro contato com ${dados.nome}`, prazo: hoje(), responsavelId: corretorId, concluida: false })
    opId = op.id
  })
  return opId
}

export function valorFaturaContrato(c: Contrato) {
  const itens = [{ descricao: 'Aluguel', valor: c.valorAluguel }, ...c.extras]
  if (c.seguroIncendio.ativo) itens.push({ descricao: 'Seguro incêndio', valor: c.seguroIncendio.valorMensal })
  return itens
}

/** Gera as faturas da competência para todos os contratos ativos (sem duplicar). */
export function gerarFaturas(competencia: string) {
  let geradas = 0
  update(db => {
    for (const c of db.contratos.filter(c => c.status === 'ativo')) {
      if (competencia < competenciaDe(c.inicio)) continue
      if (db.faturas.some(f => f.contratoId === c.id && f.competencia === competencia)) continue
      const itens = valorFaturaContrato(c)
      const dia = String(Math.min(c.diaVencimento, 28)).padStart(2, '0')
      db.faturas.unshift({ id: uid(), contratoId: c.id, competencia, vencimento: `${competencia}-${dia}`, itens, valor: round2(itens.reduce((s, i) => s + i.valor, 0)), status: 'aberta', notificacoes: [] })
      geradas++
    }
  })
  return geradas
}

function criarRepasse(db: DB, f: Fatura, garantido: boolean) {
  const c = db.contratos.find(c => c.id === f.contratoId)!
  if (db.repasses.some(r => r.faturaId === f.id)) return
  const primeiro = db.faturas.filter(x => x.contratoId === c.id).sort((a, b) => a.competencia.localeCompare(b.competencia))[0]?.id === f.id
  const pct = primeiro ? c.taxaPrimeiroAluguel : c.taxaAdm
  const taxa = round2(c.valorAluguel * pct / 100)
  // Encargos (condomínio, IPTU, seguro) são repassados integralmente; a taxa incide sobre o aluguel
  const bruto = f.valor
  db.repasses.unshift({ id: uid(), faturaId: f.id, contratoId: c.id, proprietarioId: c.proprietarioId, valorBruto: bruto, taxa, valorLiquido: round2(bruto - taxa), status: 'pendente', previsto: addDias(f.pagaEm ?? f.vencimento, 2), garantido })
  db.lancamentos.unshift({ id: uid(), tipo: 'receber', descricao: `${primeiro ? 'Taxa de intermediação' : 'Taxa de administração'} ${c.codigo} ${f.competencia}`, valor: taxa, vencimento: f.pagaEm ?? f.vencimento, competencia: f.competencia, status: garantido && f.status !== 'paga' ? 'pendente' : 'quitado', quitadoEm: f.pagaEm, planoContaId: primeiro ? 'pc3' : 'pc1', centroCustoId: 'cc2', contaBancariaId: 'cb2', pessoaId: c.proprietarioId, conciliado: false, origem: 'aluguel' })
}

export function baixarFatura(faturaId: string, data = hoje(), valorPago?: number) {
  update(db => {
    const f = db.faturas.find(f => f.id === faturaId)
    if (!f || f.status === 'paga') return
    f.status = 'paga'; f.pagaEm = data; f.valorPago = valorPago ?? f.valor
    const existente = db.repasses.find(r => r.faturaId === f.id)
    if (existente) {
      const l = db.lancamentos.find(l => l.origem === 'aluguel' && l.descricao.includes(f.competencia) && l.status === 'pendente' && l.pessoaId === existente.proprietarioId)
      if (l) { l.status = 'quitado'; l.quitadoEm = data }
    } else criarRepasse(db, f, false)
  })
}

/** Repasse garantido: antecipa ao proprietário no vencimento mesmo sem pagamento do inquilino. */
export function antecipacaoGarantida() {
  let n = 0
  update(db => {
    for (const f of db.faturas.filter(f => f.status === 'aberta' && diffDias(hoje(), f.vencimento) >= 0)) {
      const c = db.contratos.find(c => c.id === f.contratoId)
      if (c?.repasseGarantido && !db.repasses.some(r => r.faturaId === f.id)) { criarRepasse(db, f, true); n++ }
    }
  })
  return n
}

export function realizarRepasse(id: string) {
  update(db => {
    const r = db.repasses.find(r => r.id === id)
    if (!r || r.status === 'realizado') return
    r.status = 'realizado'; r.realizadoEm = hoje()
  })
}

/** Executa a régua de cobrança: registra as notificações devidas hoje em cada fatura aberta. */
export function executarRegua() {
  let enviadas = 0
  update(db => {
    for (const f of db.faturas.filter(f => f.status === 'aberta')) {
      const atraso = diffDias(hoje(), f.vencimento)
      for (const r of db.config.regua.filter(r => r.ativa)) {
        if (atraso >= r.dias && !f.notificacoes.some(n => n.regra === r.id)) {
          f.notificacoes.push({ em: agoraISO(), canal: r.canal, regra: r.id }); enviadas++
        }
      }
    }
  })
  return enviadas
}

export function aplicarReajuste(contratoId: string, percentual: number) {
  update(db => {
    const c = db.contratos.find(c => c.id === contratoId)
    if (!c) return
    const para = round2(c.valorAluguel * (1 + percentual / 100))
    c.historicoReajustes.unshift({ em: hoje(), de: c.valorAluguel, para, indice: c.indice, percentual })
    c.valorAluguel = para
  })
}

/** Cria lançamentos parcelados ou recorrentes (até 99 ocorrências). */
export function criarLancamentos(base: Omit<Lancamento, 'id' | 'parcela' | 'grupo'>, ocorrencias: number, modo: 'unico' | 'parcelado' | 'recorrente', addMesesFn: (d: string, n: number) => string) {
  const n = modo === 'unico' ? 1 : Math.min(Math.max(ocorrencias, 1), 99)
  const grupo = uid()
  update(db => {
    for (let i = 0; i < n; i++) {
      const venc = addMesesFn(base.vencimento, i)
      db.lancamentos.unshift({
        ...base, id: uid(), grupo: n > 1 ? grupo : undefined, vencimento: venc, competencia: venc.slice(0, 7),
        valor: modo === 'parcelado' ? round2(base.valor / n) : base.valor, parcela: n > 1 ? `${i + 1}/${n}` : undefined,
        status: i === 0 ? base.status : 'pendente', quitadoEm: i === 0 ? base.quitadoEm : undefined,
      })
    }
  })
}

export function saldoConta(db: DB, contaId: string) {
  const c = db.contasBancarias.find(c => c.id === contaId)
  let s = c?.saldoInicial ?? 0
  for (const l of db.lancamentos.filter(l => l.status === 'quitado')) {
    if (l.tipo === 'receber' && l.contaBancariaId === contaId) s += l.valor
    if (l.tipo === 'pagar' && l.contaBancariaId === contaId) s -= l.valor
    if (l.tipo === 'transferencia') { if (l.contaBancariaId === contaId) s -= l.valor; if (l.contaDestinoId === contaId) s += l.valor }
  }
  return round2(s)
}

export function usarCreditoIA(): boolean {
  const c = getDB().config.creditosIA
  if (c.usados >= c.limite) return false
  update(db => { db.config.creditosIA.usados++ })
  return true
}
