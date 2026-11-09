# Guarita Mob

Sistema para imobiliárias com **CRM, ERP, site e gestão de aluguéis** numa base de dados só.
Identidade visual em amarelo forte, preto e branco.

## Como rodar

Precisa do **Node.js 22.18 ou mais novo** (o banco SQLite já vem embutido no Node).

```bash
npm install
npm run dev      # sistema em http://localhost:5173 (API em :3001)
npm test         # testes do servidor
```

Em desenvolvimento é criada uma imobiliária de demonstração (`/s/demo`). Entre com
`ana@guaritamob.com.br` (admin), `bruno@…` ou `carla@…` (corretores) ou `diego@…` (financeiro),
todos com a senha `demo1234`. Para criar uma imobiliária nova, use **Criar conta** em `/cadastro`.

### Produção

```bash
npm run build
npm start        # tudo num processo só, em http://localhost:3001
```

Ou com Docker: `docker build -t guarita-mob . && docker run -p 3001:3001 -v guarita-dados:/data guarita-mob`.

| Variável | Padrão | Para que serve |
|---|---|---|
| `PORT` | `3001` | Porta do servidor |
| `DATA_DIR` | `./data` | Pasta do banco `guarita-mob.db`. **Use um disco persistente** e faça backup dela |
| `SEED_DEMO` | desligado | `1` cria a imobiliária de demonstração (não use em produção: as senhas são públicas) |
| `ALLOW_SIGNUP` | ligado | `0` fecha o cadastro de novas imobiliárias |

Serve em qualquer hospedagem que rode Node com disco persistente (Render, Railway, Fly.io, uma VPS).
Use HTTPS na frente: o cookie de sessão é marcado como seguro automaticamente.

## Como funciona

- **Servidor** (`server/`): Node.js + Express + SQLite. Cada imobiliária tem seus dados isolados.
- **Login**: senha com hash scrypt, sessão em cookie `httpOnly` de 30 dias, limite de tentativas.
- **Permissões** (checadas no servidor):
  - **Admin**: tudo, inclusive equipe e configurações.
  - **Corretor**: CRM, imóveis e site. Vê a locação mas não altera, e não vê o financeiro.
  - **Financeiro**: locação e financeiro.
- **Tempo real**: o que uma pessoa altera aparece na tela das outras na hora (Server-Sent Events).
- **Sincronização**: a tela atualiza na hora e envia só os registros alterados. Se o servidor recusar, a tela volta ao que está gravado e mostra o motivo.
- **Rotas públicas**: site de cada imobiliária em `/s/<endereço>`, vitrine do cliente e área do cliente em `/portal/<endereço>`. Elas só expõem imóveis publicados e dados mínimos.

## O que tem

| Área | Rota | Recursos |
|---|---|---|
| Site institucional | `/` | Home, páginas de cada produto, planos, integrações, agendar demonstração |
| Login e cadastro | `/login`, `/cadastro` | Entrar com e-mail e senha, criar a conta da imobiliária, trocar a própria senha |
| **CRM** | `/app/funil`, `/app/leads`… | Funil kanban com arrastar e soltar, vários funis personalizáveis, roleta de leads, oportunidades com histórico, atividades e agenda, propostas, pessoas, imóveis (fotos, portais, destaque), gestão de chaves, ranking de corretores |
| **Vitrine do cliente** | `/s/selecao/:id` | Página com imóveis do perfil do cliente e botão "agendar visita", que cai na oportunidade |
| **Locação** | `/app/alugueis`… | Contratos, faturas mensais automáticas, baixa de pagamento, boleto, régua de cobrança, reajuste por índice com simulação, cálculo de rescisão, documento do contrato, repasse com taxa de administração e de intermediação, repasse garantido, seguros e garantias, mapa de cobranças, relatório DIMOB (CSV) |
| **Financeiro** | `/app/financeiro`… | Contas a pagar e receber, transferências, parcelamento e recorrência (até 99×), cadastro rápido de pessoa com checagem de duplicidade, plano de contas, centros de custo, contas bancárias com saldo, conciliação bancária por OFX, DRE gerencial (caixa ou competência) |
| **Site da imobiliária** | `/s/<endereço>` | 15 blocos configuráveis, busca com filtros, página do imóvel com galeria e marca d'água, formulário que gera lead no CRM via roleta, blog e páginas próprias |
| Editor do site | `/app/site` | Cores, fonte, textos, blocos (ativar/ordenar), páginas e blog, prévia ao vivo desktop/celular |
| Analytics | `/app/analytics` | Visitas por dia, páginas e imóveis mais vistos, conversão em leads |
| Guarita IA | `/app/ia` | Descrição de imóvel, posts para redes sociais, cadastro de imóvel a partir de texto livre, controle de créditos |
| Área do cliente | `/portal/<endereço>` | Inquilino vê faturas; proprietário vê imóveis e extrato de repasses (entra com CPF/CNPJ + e-mail) |
| Administração | `/app/equipe`, `/app/configuracoes` | Usuários com senha e papéis, índices de reajuste, feed XML para portais, webhooks, backup JSON, importação de imóveis por CSV |

## Limitações desta versão

- Boleto/PIX, envio de WhatsApp/e-mail da régua, assinatura eletrônica e disparo de webhooks são **simulados**. Para funcionar de verdade precisam de integração com banco/gateway e provedores de mensagem.
- As regras de negócio (gerar faturas, calcular repasses etc.) rodam no navegador. O servidor confere **quem** pode alterar cada tipo de dado, mas não recalcula os valores. Para uso com muitas pessoas, o ideal é mover esses cálculos para o servidor.
- Não há recuperação de senha por e-mail: o administrador redefine a senha da equipe em **Equipe e permissões**.
- Fotos enviadas ficam dentro do banco. Para muitas fotos, o próximo passo é um armazenamento de arquivos (S3 ou similar).
- A área do cliente entra com CPF/CNPJ + e-mail, sem senha própria.
- A Guarita IA usa regras locais. Pode ser ligada a um modelo de linguagem por API.
- O relatório DIMOB é um CSV de conferência, não o arquivo no layout oficial da Receita.
- Os preços da página de planos são valores de exemplo.

## Estrutura

```
server/       API (Express + SQLite), login, permissões, tempo real e testes
src/
  lib/        tipos, dados de exemplo, sincronização, regras de negócio (usadas também pelo servidor)
  components/ componentes de interface (botões, modal, cards…)
  marketing/  site institucional do Guarita Mob
  app/        sistema interno (CRM, locação, financeiro, marketing, admin)
  site/       site público da imobiliária e área do cliente
```
