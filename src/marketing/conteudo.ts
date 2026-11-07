export interface Produto {
  slug: string; nome: string; menu: string; titulo: string; sub: string; appRota: string
  blocos: { titulo: string; texto: string; itens: string[] }[]
}

export const produtos: Produto[] = [
  {
    slug: 'crm-imobiliario', nome: 'CRM Imobiliário', menu: 'Leads, funil e atendimento', appRota: '/app/funil',
    titulo: 'Nenhum lead esquecido. Nenhuma venda perdida por descuido.',
    sub: 'Receba contatos do site, dos portais e do WhatsApp num só lugar, distribua para a equipe automaticamente e acompanhe cada negociação até a assinatura.',
    blocos: [
      { titulo: 'Roleta de leads', texto: 'Cada novo contato vai para o próximo corretor da fila, sem planilha e sem briga.', itens: ['Fila configurável por corretor', 'Distribuição automática na entrada do lead', 'Histórico completo do cliente'] },
      { titulo: 'Funil em kanban', texto: 'Arraste as oportunidades entre etapas e veja na hora o que está parado.', itens: ['Vários funis (venda, locação, captação)', 'Etapas personalizáveis', 'Alertas de negócio parado'] },
      { titulo: 'Atividades e agenda', texto: 'Ligações, visitas e retornos com responsável e prazo, ligados à oportunidade.', itens: ['Tarefas do dia e atrasadas', 'Registro de visitas', 'Próximo passo sempre visível'] },
      { titulo: 'Propostas', texto: 'Registre valor, validade e condições de cada proposta, vinculada ao imóvel.', itens: ['Status de análise e contraproposta', 'Validade com aviso', 'Ganho automático ao aceitar'] },
      { titulo: 'Vitrine do cliente', texto: 'Uma página exclusiva com os imóveis que combinam com o perfil do cliente, com botão para agendar visita.', itens: ['Seleção automática por perfil', 'Link para enviar no WhatsApp', 'Pedido de visita cai no CRM'] },
      { titulo: 'Relatórios', texto: 'Leads por origem, conversão por etapa e ranking da equipe.', itens: ['Painel em tempo real', 'Ranking de corretores', 'Origem dos leads'] },
    ],
  },
  {
    slug: 'erp-imobiliario', nome: 'ERP Imobiliário', menu: 'Financeiro e aluguéis integrados', appRota: '/app/financeiro',
    titulo: 'O back-office da imobiliária inteiro, conversando com o comercial.',
    sub: 'Locação, contas, conciliação e resultado gerencial na mesma base de dados do CRM e do site.',
    blocos: [
      { titulo: 'DRE gerencial', texto: 'Receitas, custos e despesas mês a mês, pelo regime de caixa ou de competência.', itens: ['12 meses lado a lado', 'Agrupado pelo plano de contas', 'Resultado do período'] },
      { titulo: 'Conciliação bancária', texto: 'Importe o extrato OFX e confira com os lançamentos do sistema.', itens: ['Sugestão por valor e data', 'Conciliação com um clique', 'Saldo conciliado por conta'] },
      { titulo: 'Controle de acesso', texto: 'Cada pessoa vê e faz só o que o papel dela permite.', itens: ['Papéis de administrador, corretor e financeiro', 'Equipe ativa e inativa', 'Registro de ações'] },
    ],
  },
  {
    slug: 'site-imobiliario', nome: 'Site para Imobiliária', menu: 'Site pronto e editável', appRota: '/app/site',
    titulo: 'Um site rápido, com a cara da sua imobiliária, que gera leads de verdade.',
    sub: 'Monte a página inicial com blocos prontos, mude cores e textos e veja o resultado na hora. Cada contato vira oportunidade no CRM.',
    blocos: [
      { titulo: 'Editor visual', texto: 'Ligue, desligue e reordene 15 blocos da página inicial.', itens: ['Cores, nome e slogan', 'Prévia ao vivo', 'Marca d’água nas fotos'] },
      { titulo: 'Busca de imóveis', texto: 'Filtros por finalidade, tipo, bairro, preço e quartos.', itens: ['Página do imóvel com galeria', 'Formulário de interesse', 'Botão de WhatsApp'] },
      { titulo: 'Conteúdo e SEO', texto: 'Blog e páginas institucionais para aparecer no Google.', itens: ['Blog imobiliário', 'Páginas personalizadas', 'Layout responsivo'] },
      { titulo: 'Analytics', texto: 'Saiba quais imóveis e páginas atraem mais visitas.', itens: ['Visitas por página', 'Imóveis mais vistos', 'Conversão em leads'] },
    ],
  },
  {
    slug: 'gestao-de-alugueis', nome: 'Gestão de Aluguéis', menu: 'Contratos, cobrança e repasse', appRota: '/app/alugueis',
    titulo: 'Do contrato ao repasse, a locação roda no automático.',
    sub: 'Faturas geradas todo mês, cobrança com régua de lembretes, reajuste pelo índice e repasse ao proprietário já com a taxa descontada.',
    blocos: [
      { titulo: 'Faturas automáticas', texto: 'Aluguel, condomínio, IPTU e seguro numa fatura só, gerada para todos os contratos.', itens: ['Geração por competência', 'Baixa de pagamento', 'Histórico por contrato'] },
      { titulo: 'Régua de cobrança', texto: 'Lembretes antes, no dia e depois do vencimento por e-mail, WhatsApp ou SMS.', itens: ['Regras configuráveis', 'Mensagens com variáveis', 'Registro de envios'] },
      { titulo: 'Reajuste e rescisão', texto: 'Simule o reajuste pelo índice antes de aplicar e calcule a multa de rescisão proporcional.', itens: ['IGP-M, IPCA, INPC e IVAR', 'Histórico de reajustes', 'Multa proporcional ao tempo restante'] },
      { titulo: 'Repasse ao proprietário', texto: 'Valor líquido calculado automaticamente, com opção de repasse garantido.', itens: ['Taxa de administração e de intermediação', 'Repasse garantido no vencimento', 'Extrato do proprietário'] },
      { titulo: 'Seguros e garantias', texto: 'Acompanhe seguro incêndio e garantias que estão para vencer.', itens: ['Alertas de vencimento', 'Garantia por contrato', 'Carteira de seguros'] },
      { titulo: 'Relatório para DIMOB', texto: 'Exporte os valores anuais por contrato para preencher a declaração.', itens: ['Totais por locador e locatário', 'Exportação em CSV', 'Ano-base selecionável'] },
    ],
  },
  {
    slug: 'gestao-financeira', nome: 'Gestão Financeira', menu: 'Contas, caixa e resultado', appRota: '/app/financeiro',
    titulo: 'Contas a pagar e a receber sem planilha paralela.',
    sub: 'Lançamentos com plano de contas e centro de custo, parcelamentos, recorrências, transferências e saldo por conta bancária.',
    blocos: [
      { titulo: 'Pagar e receber', texto: 'Tudo o que entra e sai, com status de pendente e quitado.', itens: ['Filtros por período e status', 'Baixa com data', 'Cadastro rápido de pessoa'] },
      { titulo: 'Parcelado e recorrente', texto: 'Crie até 99 ocorrências de uma vez.', itens: ['Parcelamento com divisão do valor', 'Recorrência mensal', 'Identificação da parcela'] },
      { titulo: 'Plano de contas e centros de custo', texto: 'Classifique cada lançamento para enxergar o resultado por área.', itens: ['Receitas e despesas', 'Centros de custo', 'Contas bancárias com saldo'] },
    ],
  },
  {
    slug: 'ia-para-imobiliaria', nome: 'Guarita IA', menu: 'Assistentes para o dia a dia', appRota: '/app/ia',
    titulo: 'Assistentes que escrevem, cadastram e respondem por você.',
    sub: 'Gere descrições de imóveis, posts para redes sociais e cadastre imóveis a partir de um texto livre.',
    blocos: [
      { titulo: 'Descrição de imóveis', texto: 'Um texto de anúncio pronto a partir das características do imóvel.', itens: ['Tom formal ou descontraído', 'Destaques automáticos', 'Copie e publique'] },
      { titulo: 'Gerador de posts', texto: 'Legenda e hashtags para divulgar imóveis nas redes.', itens: ['Formato Instagram', 'Chamada para ação', 'Hashtags do bairro'] },
      { titulo: 'Cadastro por texto', texto: 'Cole a descrição que o proprietário mandou e o sistema preenche o cadastro.', itens: ['Extrai quartos, área, preço e bairro', 'Revise antes de salvar', 'Economiza digitação'] },
    ],
  },
]

export const planosCRM = [
  { nome: 'Essencial', preco: 289, usuarios: 2, imoveis: 250, ia: 50, destaque: false, itens: ['Site padrão', 'Funil de vendas e propostas', 'Gestão de chaves', 'Vitrine do cliente', 'Integração com portais'] },
  { nome: 'Crescimento', preco: 549, usuarios: 5, imoveis: 500, ia: 150, destaque: true, itens: ['Tudo do Essencial', 'Roleta de leads', 'Funis personalizados', 'Integrações por webhook'] },
  { nome: 'Escala', preco: 1190, usuarios: 15, imoveis: 2500, ia: 300, destaque: false, itens: ['Tudo do Crescimento', 'Editor de site e analytics', 'Ranking de corretores', 'API e suporte por WhatsApp'] },
  { nome: 'Corporativo', preco: 1890, usuarios: 25, imoveis: 5000, ia: 500, destaque: false, itens: ['Tudo do Escala', 'Gerente de conta dedicado', 'Treinamento personalizado'] },
]
export const planosAluguel = [
  { nome: 'Locação Start', preco: 199, contratos: 50, destaque: false, itens: ['Contratos e documentos', 'Faturas e repasses automáticos', 'Régua de cobrança', 'Relatório para DIMOB', 'Área do inquilino e do proprietário'] },
  { nome: 'Locação Plus', preco: 449, contratos: 250, destaque: true, itens: ['Tudo do Start', 'Gestão financeira completa', 'Conciliação bancária e DRE', 'API'] },
  { nome: 'Locação Pro', preco: 890, contratos: 750, destaque: false, itens: ['Tudo do Plus', 'Gerente de conta dedicado'] },
]

export const faq = [
  { p: 'Quanto custa?', r: 'Depende dos módulos e do tamanho da equipe. Veja a página de planos ou fale com a gente para montar o pacote certo.' },
  { p: 'Consigo trazer meus dados do sistema atual?', r: 'Sim. Importamos imóveis, clientes e contratos em lote e acompanhamos a migração até a equipe estar usando.' },
  { p: 'Preciso instalar alguma coisa?', r: 'Não. O Guarita Mob roda no navegador, no computador ou no celular.' },
  { p: 'Os dados ficam seguros?', r: 'O acesso é controlado por papéis, cada usuário vê só o que precisa, e todas as ações ficam registradas.' },
  { p: 'Posso contratar só a gestão de aluguéis?', r: 'Pode. Os módulos funcionam separados e se integram quando você contratar os outros.' },
]
