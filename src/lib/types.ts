export type ID = string

export type Papel = 'admin' | 'corretor' | 'financeiro'
export interface Usuario { id: ID; nome: string; email: string; telefone: string; papel: Papel; ativo: boolean }

export type TipoPessoa = 'cliente' | 'proprietario' | 'inquilino' | 'fornecedor'
export interface Pessoa { id: ID; nome: string; email: string; telefone: string; documento: string; tipos: TipoPessoa[]; criadoEm: string }

export type StatusImovel = 'disponivel' | 'reservado' | 'vendido' | 'alugado' | 'inativo'
export type Finalidade = 'venda' | 'aluguel'
export interface Imovel {
  id: ID; codigo: string; titulo: string; tipo: string; finalidade: Finalidade; preco: number; condominio: number; iptu: number
  endereco: string; bairro: string; cidade: string; quartos: number; banheiros: number; vagas: number; area: number
  descricao: string; fotos: string[]; status: StatusImovel; proprietarioId?: ID; destaque: boolean; publicadoSite: boolean
  portais: string[]; chave: { local: string; retiradaPor?: string; retiradaEm?: string }; criadoEm: string
}

export interface Etapa { id: ID; nome: string }
export interface Funil { id: ID; nome: string; etapas: Etapa[] }

export type StatusOportunidade = 'aberta' | 'ganha' | 'perdida'
export interface Oportunidade {
  id: ID; titulo: string; pessoaId: ID; funilId: ID; etapaId: ID; corretorId?: ID; imovelId?: ID; origem: string; valor: number
  status: StatusOportunidade; motivoPerda?: string; criadoEm: string; atualizadoEm: string
  perfil: { finalidade?: Finalidade; tipo?: string; bairro?: string; precoMax?: number; quartosMin?: number }
  historico: { em: string; texto: string }[]
}

export type TipoAtividade = 'ligacao' | 'visita' | 'tarefa' | 'email' | 'whatsapp' | 'reuniao'
export interface Atividade { id: ID; oportunidadeId?: ID; tipo: TipoAtividade; descricao: string; prazo: string; responsavelId?: ID; concluida: boolean }

export type StatusProposta = 'em_analise' | 'aceita' | 'recusada' | 'contraproposta'
export interface Proposta { id: ID; oportunidadeId: ID; imovelId: ID; valor: number; validade: string; observacoes: string; status: StatusProposta; criadoEm: string }

export type Indice = 'IGP-M' | 'IPCA' | 'INPC' | 'IVAR'
export interface Contrato {
  id: ID; codigo: string; imovelId: ID; proprietarioId: ID; inquilinoId: ID; valorAluguel: number; taxaAdm: number; taxaPrimeiroAluguel: number
  diaVencimento: number; inicio: string; duracaoMeses: number; indice: Indice; garantia: string; seguroIncendio: { ativo: boolean; seguradora: string; vencimento: string; valorMensal: number }
  repasseGarantido: boolean; status: 'ativo' | 'encerrado'; encerradoEm?: string; extras: { descricao: string; valor: number }[]
  historicoReajustes: { em: string; de: number; para: number; indice: Indice; percentual: number }[]
}

export type StatusFatura = 'aberta' | 'paga' | 'cancelada'
export interface Fatura {
  id: ID; contratoId: ID; competencia: string; vencimento: string; itens: { descricao: string; valor: number }[]; valor: number
  status: StatusFatura; pagaEm?: string; valorPago?: number; notificacoes: { em: string; canal: string; regra: string }[]
}

export interface Repasse { id: ID; faturaId: ID; contratoId: ID; proprietarioId: ID; valorBruto: number; taxa: number; valorLiquido: number; status: 'pendente' | 'realizado'; previsto: string; realizadoEm?: string; garantido: boolean }

export interface PlanoConta { id: ID; codigo: string; nome: string; tipo: 'receita' | 'despesa' }
export interface CentroCusto { id: ID; nome: string }
export interface ContaBancaria { id: ID; nome: string; banco: string; saldoInicial: number }

export interface Lancamento {
  id: ID; tipo: 'receber' | 'pagar' | 'transferencia'; descricao: string; valor: number; vencimento: string; competencia: string
  status: 'pendente' | 'quitado'; quitadoEm?: string; planoContaId?: ID; centroCustoId?: ID; contaBancariaId: ID; contaDestinoId?: ID
  pessoaId?: ID; parcela?: string; grupo?: string; conciliado: boolean; origem?: string
}

export type TipoComponenteSite = 'banner' | 'busca' | 'destaques' | 'lancamentos' | 'aluguel' | 'venda' | 'sobre' | 'equipe' | 'depoimentos' | 'contato' | 'blog' | 'servicos' | 'numeros' | 'mapa' | 'anuncie'
export interface SiteConfig {
  nome: string; slogan: string; corPrimaria: string; corSecundaria: string; fonte: string; whatsapp: string; email: string; endereco: string
  sobre: string; marcaDagua: boolean; componentes: { id: ID; tipo: TipoComponenteSite; ativo: boolean }[]
  paginas: { id: ID; titulo: string; conteudo: string }[]; posts: { id: ID; titulo: string; conteudo: string; em: string }[]
}

export interface ReguaRegra { id: ID; dias: number; canal: 'email' | 'whatsapp' | 'sms'; mensagem: string; ativa: boolean }

export interface Config {
  roleta: { ativa: boolean; corretores: ID[]; ponteiro: number; apenasHorarioComercial: boolean }
  regua: ReguaRegra[]
  indices: Record<Indice, number>
  creditosIA: { usados: number; limite: number }
  webhooks: { id: ID; url: string; evento: string }[]
}

export interface DB {
  usuarios: Usuario[]; pessoas: Pessoa[]; imoveis: Imovel[]; funis: Funil[]; oportunidades: Oportunidade[]; atividades: Atividade[]
  propostas: Proposta[]; contratos: Contrato[]; faturas: Fatura[]; repasses: Repasse[]; planoContas: PlanoConta[]; centrosCusto: CentroCusto[]
  contasBancarias: ContaBancaria[]; lancamentos: Lancamento[]; site: SiteConfig; config: Config; analytics: { visitas: { data: string; pagina: string; imovelId?: ID }[] }
}
