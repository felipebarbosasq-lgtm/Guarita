# DOM Web

Sistema de pedidos online para restaurantes: cardápio digital, gestor de pedidos, PDV, cupons, clientes, relatórios e atendimento no WhatsApp com IA.
Identidade visual em amarelo, preto e branco. Já vem com o cardápio da **Dom Pappiro** importado (73 produtos, fotos e adicionais).

## O que já funciona

**Cardápio do cliente** (`/`)
- Capa, logo, situação da loja (aberta/fechada pelo horário), pedido mínimo e tempos.
- Entrega ou retirada, busca, categorias fixas no topo, fotos.
- Produto com opções e adicionais (obrigatórios ou não, mínimo/máximo), observação e quantidade.
- Carrinho com edição, cupom de desconto, taxa de entrega por bairro, entrega grátis acima de um valor.
- Finalização com nome, WhatsApp, endereço, ponto de referência, forma de pagamento, troco e chave Pix.
- Página de acompanhamento do pedido em tempo real e botão para **enviar o pedido no WhatsApp da loja**.
- Pedido na mesa por link/QR Code: `/?mesa=5`.

**Painel do restaurante** (`/admin/`)
- **Pedidos**: quadro Novos → Em preparo → Pronto/Em entrega → Concluídos, com alerta sonoro, notificação no navegador, contador e tempo de cada pedido.
- Aceitar, avançar, cancelar, imprimir comanda (impressora térmica 80 mm ou comum) e avisar o cliente no WhatsApp com mensagem pronta.
- **PDV / Balcão**: lançar pedidos de balcão, mesa, retirada ou entrega (telefone).
- **Cardápio**: categorias (ordem, ocultar), produtos (foto, preço, promoção, destaque, pausar), grupos de adicionais.
- **Entrega**: modos de atendimento, tempos, pedido mínimo, bairros e taxas.
- **Cupons**: % ou R$, valor mínimo, contagem de usos.
- **Clientes**: histórico, total gasto, WhatsApp, exportar planilha.
- **Relatórios**: faturamento, ticket médio, vendas por dia, mais vendidos, por pagamento e por tipo.
- **Minha loja**: dados, logo, capa, horários (inclusive depois da meia-noite), formas de pagamento, Pix.
- Abrir/fechar a loja manualmente ou deixar no horário automático.

**WhatsApp e IA**
- Sem configuração nenhuma: o pedido vai para o WhatsApp da loja pelo link `wa.me`, e o painel monta as mensagens de status para o cliente.
- Com a API oficial da Meta + chave da Claude: atendente automático 24 h que responde dúvidas com o cardápio, horários e taxas, envia o link do pedido, informa o status do pedido do cliente e avisa o cliente automaticamente a cada mudança de status.

## Testar no seu computador

Precisa do [Node.js 20+](https://nodejs.org).

```bash
cd domweb
npm run preview
```

Abra http://localhost:8788 (cardápio) e http://localhost:8788/admin/ (painel).
Sem banco configurado, o sistema roda em **modo demonstração**: tudo fica salvo no navegador. Faça um pedido em uma aba e veja chegar no painel na outra.
Fora do horário de funcionamento, use “Loja aberta” no topo do painel para testar.

Teste automático (abre o navegador, faz um pedido completo e confere o painel): `npm test` com o preview rodando.

## Colocar no ar (grátis para começar)

1. **Supabase** (banco de dados): crie um projeto em supabase.com.
   - SQL Editor → rode `supabase/schema.sql` e depois `supabase/seed.sql`.
   - Authentication → Providers → Email: **desligue “Allow new users to sign up”**.
   - Authentication → Users → **Add user**: este será o login do painel.
2. **Netlify**: “Add new site” → importe este repositório do GitHub.
   - **Base directory**: `domweb` (o resto o `netlify.toml` já configura).
   - Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `SITE_URL` (o endereço do site).
   - Faça o deploy. Pronto: cardápio no endereço do site e painel em `/admin/`.
3. **WhatsApp com IA** (opcional): siga o passo a passo na tela **WhatsApp e IA** do painel. Variáveis: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `ANTHROPIC_API_KEY` (opcional `CLAUDE_MODEL`, padrão `claude-haiku-5-5`).

## Atualizar o cardápio a partir da Cardápio Web

```bash
node tools/importar-cardapioweb.mjs dom_pappiro   # baixa produtos e fotos
python3 tools/otimizar_imagens.py                 # reduz o tamanho das fotos
npm run seed-sql                                   # gera supabase/seed.sql
```

## Como é feito

- Site estático (HTML, CSS e JavaScript puro, sem framework): rápido e barato de hospedar.
- `public/js/nucleo.js`: regras de preço, horários e mensagens. O mesmo código roda no navegador e no servidor; o servidor **recalcula o valor de todo pedido**, então ninguém consegue alterar preço pelo navegador.
- `netlify/functions/pedidos.mjs`: cria pedidos, consulta andamento, valida cupons.
- `netlify/functions/whatsapp.mjs`: webhook da Meta + IA Claude.
- `netlify/functions/notificar.mjs`: avisos automáticos de status pelo WhatsApp.
- `supabase/schema.sql`: tabelas e regras de segurança (o público só lê o cardápio).

## Próximas etapas

- Mesas e comandas com conta aberta, QR Codes impressos e tela da cozinha (KDS).
- Cadastro de entregadores e acerto de entregas.
- Pix com confirmação automática (Mercado Pago/Asaas) e cartão online.
- Programa de fidelidade (pontos/cashback).
- Integração com iFood.
- Vários restaurantes no mesmo sistema (para vender o DOM Web como assinatura).
- Nota fiscal (NFC-e) — fica para quando você quiser.
