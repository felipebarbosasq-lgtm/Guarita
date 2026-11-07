import type { DB, Imovel } from './types'
import { addDias, addMeses, hoje, placeholderFoto } from './format'

export function criarSeed(): DB {
  const h = hoje()
  const usuarios = [
    { id: 'u1', nome: 'Ana Souza', email: 'ana@guaritamob.com.br', telefone: '(11) 98888-1001', papel: 'admin' as const, ativo: true },
    { id: 'u2', nome: 'Bruno Lima', email: 'bruno@guaritamob.com.br', telefone: '(11) 98888-1002', papel: 'corretor' as const, ativo: true },
    { id: 'u3', nome: 'Carla Mendes', email: 'carla@guaritamob.com.br', telefone: '(11) 98888-1003', papel: 'corretor' as const, ativo: true },
    { id: 'u4', nome: 'Diego Rocha', email: 'diego@guaritamob.com.br', telefone: '(11) 98888-1004', papel: 'financeiro' as const, ativo: true },
  ]
  const pessoas = [
    { id: 'p1', nome: 'Marcos Pereira', email: 'marcos@email.com', telefone: '(11) 97777-0001', documento: '123.456.789-00', tipos: ['proprietario' as const], criadoEm: addDias(h, -200) },
    { id: 'p2', nome: 'Juliana Alves', email: 'juliana@email.com', telefone: '(11) 97777-0002', documento: '234.567.890-11', tipos: ['inquilino' as const], criadoEm: addDias(h, -180) },
    { id: 'p3', nome: 'Rafael Costa', email: 'rafael@email.com', telefone: '(11) 97777-0003', documento: '345.678.901-22', tipos: ['cliente' as const], criadoEm: addDias(h, -12) },
    { id: 'p4', nome: 'Patrícia Gomes', email: 'patricia@email.com', telefone: '(11) 97777-0004', documento: '456.789.012-33', tipos: ['cliente' as const], criadoEm: addDias(h, -6) },
    { id: 'p5', nome: 'Helena Martins', email: 'helena@email.com', telefone: '(11) 97777-0005', documento: '567.890.123-44', tipos: ['proprietario' as const], criadoEm: addDias(h, -300) },
    { id: 'p6', nome: 'Thiago Ribeiro', email: 'thiago@email.com', telefone: '(11) 97777-0006', documento: '678.901.234-55', tipos: ['inquilino' as const], criadoEm: addDias(h, -90) },
    { id: 'p7', nome: 'Limpeza Brilho Ltda', email: 'contato@brilho.com', telefone: '(11) 3333-0007', documento: '12.345.678/0001-90', tipos: ['fornecedor' as const], criadoEm: addDias(h, -400) },
    { id: 'p8', nome: 'Fernanda Dias', email: 'fernanda@email.com', telefone: '(11) 97777-0008', documento: '789.012.345-66', tipos: ['cliente' as const], criadoEm: addDias(h, -2) },
  ]
  const base = (o: Partial<Imovel> & Pick<Imovel, 'id' | 'codigo' | 'titulo'>): Imovel => ({
    tipo: 'Apartamento', finalidade: 'venda', preco: 0, condominio: 0, iptu: 0, endereco: '', bairro: '', cidade: 'São Paulo',
    quartos: 2, banheiros: 1, vagas: 1, area: 60, descricao: '', fotos: [placeholderFoto(o.id, o.codigo)], status: 'disponivel',
    destaque: false, publicadoSite: true, portais: ['Portal A', 'Portal B'], chave: { local: 'Quadro 1' }, criadoEm: addDias(h, -60), ...o,
  })
  const imoveis: Imovel[] = [
    base({ id: 'i1', codigo: 'GM-101', titulo: 'Apartamento com varanda gourmet', bairro: 'Vila Mariana', endereco: 'Rua Domingos de Morais, 1200', preco: 780000, condominio: 850, iptu: 210, quartos: 3, banheiros: 2, vagas: 2, area: 92, destaque: true, proprietarioId: 'p5', descricao: 'Apartamento claro, com varanda gourmet, três dormitórios sendo uma suíte e duas vagas.' }),
    base({ id: 'i2', codigo: 'GM-102', titulo: 'Studio mobiliado perto do metrô', bairro: 'Pinheiros', endereco: 'Rua dos Pinheiros, 500', finalidade: 'aluguel', preco: 3200, condominio: 600, iptu: 90, quartos: 1, area: 32, vagas: 0, status: 'alugado', proprietarioId: 'p1', destaque: true }),
    base({ id: 'i3', codigo: 'GM-103', titulo: 'Casa térrea com quintal', tipo: 'Casa', bairro: 'Butantã', endereco: 'Rua Alvarenga, 300', preco: 1150000, quartos: 4, banheiros: 3, vagas: 3, area: 210, proprietarioId: 'p5', destaque: true }),
    base({ id: 'i4', codigo: 'GM-104', titulo: 'Apartamento de 2 dormitórios', bairro: 'Moema', endereco: 'Av. Ibirapuera, 2100', finalidade: 'aluguel', preco: 4500, condominio: 980, iptu: 150, area: 70, status: 'alugado', proprietarioId: 'p1' }),
    base({ id: 'i5', codigo: 'GM-105', titulo: 'Sala comercial com 2 vagas', tipo: 'Sala comercial', bairro: 'Itaim Bibi', endereco: 'Rua Joaquim Floriano, 800', finalidade: 'aluguel', preco: 6800, condominio: 1400, quartos: 0, banheiros: 2, vagas: 2, area: 85 }),
    base({ id: 'i6', codigo: 'GM-106', titulo: 'Cobertura duplex com piscina', tipo: 'Cobertura', bairro: 'Perdizes', endereco: 'Rua Cardoso de Almeida, 950', preco: 2350000, quartos: 4, banheiros: 4, vagas: 3, area: 260, destaque: true, status: 'reservado' }),
    base({ id: 'i7', codigo: 'GM-107', titulo: 'Terreno plano de 400 m²', tipo: 'Terreno', bairro: 'Granja Viana', cidade: 'Cotia', endereco: 'Estrada da Granja, 45', preco: 520000, quartos: 0, banheiros: 0, vagas: 0, area: 400 }),
  ]
  const funis = [
    { id: 'f1', nome: 'Vendas', etapas: [{ id: 'e1', nome: 'Novo lead' }, { id: 'e2', nome: 'Contato feito' }, { id: 'e3', nome: 'Visita agendada' }, { id: 'e4', nome: 'Proposta' }, { id: 'e5', nome: 'Negociação' }] },
    { id: 'f2', nome: 'Locação', etapas: [{ id: 'l1', nome: 'Novo lead' }, { id: 'l2', nome: 'Visita' }, { id: 'l3', nome: 'Análise cadastral' }, { id: 'l4', nome: 'Contrato' }] },
  ]
  const op = (id: string, titulo: string, pessoaId: string, etapaId: string, corretorId: string, origem: string, valor: number, dias: number, imovelId?: string, funilId = 'f1') => ({
    id, titulo, pessoaId, funilId, etapaId, corretorId, imovelId, origem, valor, status: 'aberta' as const, criadoEm: addDias(h, -dias), atualizadoEm: addDias(h, -Math.floor(dias / 2)),
    perfil: { finalidade: funilId === 'f1' ? 'venda' as const : 'aluguel' as const, quartosMin: 2, precoMax: valor * 1.2 }, historico: [{ em: addDias(h, -dias), texto: `Lead criado via ${origem}` }],
  })
  const oportunidades = [
    op('o1', 'Rafael — apto 3 dorm. Vila Mariana', 'p3', 'e3', 'u2', 'Site', 780000, 12, 'i1'),
    op('o2', 'Patrícia — casa zona oeste', 'p4', 'e2', 'u3', 'Portal A', 1100000, 6, 'i3'),
    op('o3', 'Fernanda — sala comercial', 'p8', 'l1', 'u2', 'WhatsApp', 6800, 2, 'i5', 'f2'),
    op('o4', 'Rafael — cobertura', 'p3', 'e4', 'u3', 'Indicação', 2300000, 20, 'i6'),
  ]
  const atividades = [
    { id: 'a1', oportunidadeId: 'o1', tipo: 'visita' as const, descricao: 'Visita ao GM-101', prazo: addDias(h, 1), responsavelId: 'u2', concluida: false },
    { id: 'a2', oportunidadeId: 'o2', tipo: 'ligacao' as const, descricao: 'Retornar sobre financiamento', prazo: h, responsavelId: 'u3', concluida: false },
    { id: 'a3', oportunidadeId: 'o4', tipo: 'reuniao' as const, descricao: 'Apresentar contraproposta ao proprietário', prazo: addDias(h, -1), responsavelId: 'u3', concluida: false },
  ]
  const propostas = [{ id: 'pr1', oportunidadeId: 'o4', imovelId: 'i6', valor: 2200000, validade: addDias(h, 5), observacoes: 'Entrada de 40% e financiamento do restante.', status: 'em_analise' as const, criadoEm: addDias(h, -3) }]
  const inicio1 = addMeses(h, -8), inicio2 = addMeses(h, -14)
  const contratos = [
    { id: 'c1', codigo: 'LOC-001', imovelId: 'i2', proprietarioId: 'p1', inquilinoId: 'p2', valorAluguel: 3200, taxaAdm: 10, taxaPrimeiroAluguel: 100, diaVencimento: 10, inicio: inicio1, duracaoMeses: 30, indice: 'IGP-M' as const, garantia: 'Seguro fiança', seguroIncendio: { ativo: true, seguradora: 'Seguradora Exemplo', vencimento: addMeses(h, 4), valorMensal: 25 }, repasseGarantido: true, status: 'ativo' as const, extras: [{ descricao: 'Condomínio', valor: 600 }, { descricao: 'IPTU', valor: 90 }], historicoReajustes: [] },
    { id: 'c2', codigo: 'LOC-002', imovelId: 'i4', proprietarioId: 'p1', inquilinoId: 'p6', valorAluguel: 4500, taxaAdm: 8, taxaPrimeiroAluguel: 100, diaVencimento: 5, inicio: inicio2, duracaoMeses: 30, indice: 'IPCA' as const, garantia: 'Caução (3 aluguéis)', seguroIncendio: { ativo: true, seguradora: 'Seguradora Exemplo', vencimento: addDias(h, 20), valorMensal: 32 }, repasseGarantido: false, status: 'ativo' as const, extras: [], historicoReajustes: [] },
  ]
  const planoContas = [
    { id: 'pc1', codigo: '1.01', nome: 'Taxa de administração', tipo: 'receita' as const },
    { id: 'pc2', codigo: '1.02', nome: 'Comissão de vendas', tipo: 'receita' as const },
    { id: 'pc3', codigo: '1.03', nome: 'Taxa de intermediação', tipo: 'receita' as const },
    { id: 'pc4', codigo: '2.01', nome: 'Salários e encargos', tipo: 'despesa' as const },
    { id: 'pc5', codigo: '2.02', nome: 'Aluguel do escritório', tipo: 'despesa' as const },
    { id: 'pc6', codigo: '2.03', nome: 'Marketing e portais', tipo: 'despesa' as const },
    { id: 'pc7', codigo: '2.04', nome: 'Serviços de terceiros', tipo: 'despesa' as const },
  ]
  const centrosCusto = [{ id: 'cc1', nome: 'Vendas' }, { id: 'cc2', nome: 'Locação' }, { id: 'cc3', nome: 'Administrativo' }]
  const contasBancarias = [{ id: 'cb1', nome: 'Conta principal', banco: 'Banco Exemplo', saldoInicial: 25000 }, { id: 'cb2', nome: 'Conta repasses', banco: 'Banco Exemplo', saldoInicial: 8000 }]
  const lancamentos = [
    { id: 'lc1', tipo: 'pagar' as const, descricao: 'Aluguel do escritório', valor: 5500, vencimento: addDias(h, 3), competencia: h.slice(0, 7), status: 'pendente' as const, planoContaId: 'pc5', centroCustoId: 'cc3', contaBancariaId: 'cb1', conciliado: false },
    { id: 'lc2', tipo: 'pagar' as const, descricao: 'Anúncios em portais', valor: 1200, vencimento: addDias(h, -10), competencia: addDias(h, -10).slice(0, 7), status: 'quitado' as const, quitadoEm: addDias(h, -10), planoContaId: 'pc6', centroCustoId: 'cc1', contaBancariaId: 'cb1', conciliado: false },
    { id: 'lc3', tipo: 'receber' as const, descricao: 'Comissão venda GM-090', valor: 36000, vencimento: addDias(h, -25), competencia: addDias(h, -25).slice(0, 7), status: 'quitado' as const, quitadoEm: addDias(h, -24), planoContaId: 'pc2', centroCustoId: 'cc1', contaBancariaId: 'cb1', conciliado: false },
    { id: 'lc4', tipo: 'pagar' as const, descricao: 'Limpeza do escritório', valor: 650, vencimento: addDias(h, 8), competencia: h.slice(0, 7), status: 'pendente' as const, planoContaId: 'pc7', centroCustoId: 'cc3', contaBancariaId: 'cb1', pessoaId: 'p7', conciliado: false },
    { id: 'lc5', tipo: 'pagar' as const, descricao: 'Folha de pagamento', valor: 18000, vencimento: addMeses(h, -1), competencia: addMeses(h, -1).slice(0, 7), status: 'quitado' as const, quitadoEm: addMeses(h, -1), planoContaId: 'pc4', centroCustoId: 'cc3', contaBancariaId: 'cb1', conciliado: false },
  ]
  const tipos = ['banner', 'busca', 'destaques', 'venda', 'aluguel', 'numeros', 'sobre', 'servicos', 'depoimentos', 'equipe', 'blog', 'anuncie', 'contato', 'mapa', 'lancamentos'] as const
  const ativos = new Set(['banner', 'busca', 'destaques', 'venda', 'aluguel', 'sobre', 'anuncie', 'contato'])
  return {
    usuarios, pessoas, imoveis, funis, oportunidades, atividades, propostas, contratos, faturas: [], repasses: [], planoContas, centrosCusto, contasBancarias, lancamentos,
    site: {
      nome: 'Imobiliária Guarita', slogan: 'Seu próximo endereço começa aqui.', corPrimaria: '#FFD400', corSecundaria: '#0A0A0A', fonte: 'Inter', whatsapp: '5511988881001',
      email: 'contato@imobiliariaguarita.com.br', endereco: 'Av. Paulista, 1000 — São Paulo/SP', sobre: 'Somos uma imobiliária de bairro com atendimento próximo, compra, venda e administração de aluguéis.',
      marcaDagua: true, componentes: tipos.map((t, i) => ({ id: 'sc' + i, tipo: t, ativo: ativos.has(t) })),
      paginas: [{ id: 'pg1', titulo: 'Quem somos', conteudo: 'Atuamos em São Paulo há mais de 10 anos.' }],
      posts: [{ id: 'bp1', titulo: 'Como escolher o bairro ideal', conteudo: 'Considere transporte, comércio, segurança e o seu estilo de vida.', em: addDias(h, -15) }],
    },
    config: {
      roleta: { ativa: true, corretores: ['u2', 'u3'], ponteiro: 0, apenasHorarioComercial: false },
      regua: [
        { id: 'r1', dias: -5, canal: 'email', mensagem: 'Olá {inquilino}, sua fatura de {valor} vence em {vencimento}.', ativa: true },
        { id: 'r2', dias: 0, canal: 'whatsapp', mensagem: 'Olá {inquilino}, sua fatura vence hoje. Valor: {valor}.', ativa: true },
        { id: 'r3', dias: 3, canal: 'whatsapp', mensagem: 'Olá {inquilino}, identificamos atraso na fatura de {vencimento}.', ativa: true },
        { id: 'r4', dias: 10, canal: 'email', mensagem: 'Aviso de inadimplência: fatura de {vencimento} em aberto.', ativa: false },
      ],
      indices: { 'IGP-M': 3.8, IPCA: 4.5, INPC: 4.2, IVAR: 5.1 },
      creditosIA: { usados: 0, limite: 150 },
      webhooks: [],
    },
    analytics: { visitas: [] },
  }
}
