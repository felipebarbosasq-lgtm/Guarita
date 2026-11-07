# Guarita Mob

Sistema para imobiliárias com **CRM, ERP, site e gestão de aluguéis** numa base de dados só.
Identidade visual em amarelo forte, preto e branco.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera a versão de produção em dist/
```

## O que tem

| Área | Rota | Recursos |
|---|---|---|
| Site institucional | `/` | Home, páginas de cada produto, planos, integrações, agendar demonstração |
| Login | `/login` | Escolha um usuário de demonstração (admin, corretor ou financeiro) |
| **CRM** | `/app/funil`, `/app/leads`… | Funil kanban com arrastar e soltar, vários funis personalizáveis, roleta de leads, oportunidades com histórico, atividades e agenda, propostas, pessoas, imóveis (fotos, portais, destaque), gestão de chaves, ranking de corretores |
| **Vitrine do cliente** | `/s/selecao/:id` | Página com imóveis do perfil do cliente e botão "agendar visita", que cai na oportunidade |
| **Locação** | `/app/alugueis`… | Contratos, faturas mensais automáticas, baixa de pagamento, boleto, régua de cobrança, reajuste por índice com simulação, cálculo de rescisão, documento do contrato, repasse com taxa de administração e de intermediação, repasse garantido, seguros e garantias, mapa de cobranças, relatório DIMOB (CSV) |
| **Financeiro** | `/app/financeiro`… | Contas a pagar e receber, transferências, parcelamento e recorrência (até 99×), cadastro rápido de pessoa com checagem de duplicidade, plano de contas, centros de custo, contas bancárias com saldo, conciliação bancária por OFX, DRE gerencial (caixa ou competência) |
| **Site da imobiliária** | `/s` | 15 blocos configuráveis, busca com filtros, página do imóvel com galeria e marca d'água, formulário que gera lead no CRM via roleta, blog e páginas próprias |
| Editor do site | `/app/site` | Cores, fonte, textos, blocos (ativar/ordenar), páginas e blog, prévia ao vivo desktop/celular |
| Analytics | `/app/analytics` | Visitas por dia, páginas e imóveis mais vistos, conversão em leads |
| Guarita IA | `/app/ia` | Descrição de imóvel, posts para redes sociais, cadastro de imóvel a partir de texto livre, controle de créditos |
| Área do cliente | `/portal` | Inquilino vê faturas; proprietário vê imóveis e extrato de repasses |
| Administração | `/app/equipe`, `/app/configuracoes` | Usuários e papéis, índices de reajuste, feed XML para portais, webhooks, backup JSON, importação de imóveis por CSV |

## Limitações desta versão

- **Os dados ficam no navegador** (`localStorage`). Cada navegador tem a sua cópia e não há servidor nem login de verdade. O próximo passo para produção é um backend (por exemplo Supabase ou Node + PostgreSQL) com autenticação. Toda a leitura e gravação passa por `src/lib/store.ts`, então a troca fica concentrada ali.
- Boleto/PIX, envio de WhatsApp/e-mail da régua, assinatura eletrônica e disparo de webhooks são **simulados**. Para funcionar de verdade precisam de integração com banco/gateway e provedores de mensagem.
- A Guarita IA usa regras locais. Pode ser ligada a um modelo de linguagem por API.
- O relatório DIMOB é um CSV de conferência, não o arquivo no layout oficial da Receita.
- Os preços da página de planos são valores de exemplo.

## Estrutura

```
src/
  lib/        tipos, dados de exemplo, store e regras de negócio
  components/ componentes de interface (botões, modal, cards…)
  marketing/  site institucional do Guarita Mob
  app/        sistema interno (CRM, locação, financeiro, marketing, admin)
  site/       site público da imobiliária e área do cliente
```

## Publicação

É um app de página única (SPA). Na hospedagem, configure todas as rotas para devolver `index.html`.
Os arquivos `vercel.json` e `public/_redirects` (Netlify) já fazem isso.
