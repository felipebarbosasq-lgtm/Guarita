// Teste de ponta a ponta no modo demonstração:
// cliente monta o pedido no cardápio → pedido aparece no painel → restaurante aceita e conclui.
// Uso: npm run preview (em outro terminal) e depois npm test
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8788';
const SHOTS = process.env.SHOTS || 'tests/telas';
fs.mkdirSync(SHOTS, { recursive: true });
const ok = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('✓', m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
const erros = [];
const pagina = async () => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message));
  p.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  return p;
};

// Painel: força a loja aberta para o teste funcionar a qualquer hora
const admin = await pagina();
await admin.goto(`${BASE}/admin/#pedidos`);
await admin.waitForSelector('#statusLoja');
await admin.selectOption('#statusLoja', 'aberta');
await admin.waitForTimeout(300);

const loja = await pagina();
await loja.goto(BASE + '/');
await loja.waitForSelector('.produto');
ok((await loja.textContent('#nomeLoja')) === 'Dom Pappiro', 'cardápio carregou a loja Dom Pappiro');
ok((await loja.locator('.produto').count()) > 60, 'produtos importados aparecem');
await loja.screenshot({ path: `${SHOTS}/1-cardapio.png` });

// Produto com grupo de opções (Dom Classic: escolha do pão)
await loja.locator('.produto', { hasText: 'Dom Classic' }).first().click();
await loja.waitForSelector('.folha.ver');
await loja.locator('.opcao', { hasText: 'Pão Árabe' }).click();
await loja.locator('#qtdItem button[data-d="1"]').click();
await loja.screenshot({ path: `${SHOTS}/2-produto.png` });
await loja.click('#btnAdd');
await loja.waitForTimeout(300);
await loja.locator('.produto', { hasText: 'Coca-Cola Original' }).first().click();
await loja.click('#btnAdd');
await loja.waitForTimeout(300);
ok((await loja.textContent('#barraQtd')) === '3', 'carrinho com 3 itens');

await loja.click('#barraCarrinho');
await loja.waitForSelector('#continuar');
await loja.screenshot({ path: `${SHOTS}/3-carrinho.png` });
await loja.click('#continuar');
await loja.waitForSelector('#cNome');
await loja.fill('#cNome', 'Cliente Teste');
await loja.fill('#cTel', '88999990000');
await loja.selectOption('#cBairro', { index: 1 });
await loja.fill('#cRua', 'Rua das Flores');
await loja.fill('#cNum', '123');
await loja.fill('#cRef', 'Perto da praça');
await loja.locator('.opcoes-pag label', { hasText: 'Dinheiro' }).click();
await loja.fill('#cTroco', '100');
await loja.screenshot({ path: `${SHOTS}/4-finalizar.png`, fullPage: true });
await loja.click('#enviar');
await loja.waitForURL(/pedido\.html/);
await loja.waitForSelector('.estado');
ok((await loja.textContent('.estado')).includes('Pedido recebido'), 'pedido criado e página de acompanhamento aberta');
const whats = await loja.getAttribute('.btn-whats', 'href');
ok(whats.startsWith('https://wa.me/5588992055132?text='), 'botão envia o pedido para o WhatsApp da loja');
// (18,99 + 2,50) x2 + 6,00 + taxa 3,00 = 51,98
ok(/R\$\s51,98/.test(decodeURIComponent(whats)), 'total calculado corretamente (51,98)');
await loja.screenshot({ path: `${SHOTS}/5-acompanhar.png`, fullPage: true });

// Painel recebe o pedido
await admin.setViewportSize({ width: 1280, height: 800 });
await admin.reload();
await admin.waitForSelector('.card-ped.novo');
ok((await admin.locator('.card-ped.novo').count()) === 1, 'pedido apareceu no painel como Novo');
await admin.screenshot({ path: `${SHOTS}/6-painel-pedidos.png` });
await admin.locator('.card-ped.novo button[data-s="preparo"]').click();
await admin.waitForSelector('#modal');
ok((await admin.locator('#modal .btn-whats').getAttribute('href')).includes('wa.me/5588999990000'), 'oferece avisar o cliente no WhatsApp');
await admin.click('#modal [data-f]');

await loja.reload();
await loja.waitForSelector('.estado');
ok((await loja.textContent('.estado')).includes('Em preparo'), 'cliente vê o status "Em preparo"');

// Outras telas do painel abrem sem erro
for (const r of ['pdv', 'cardapio', 'entrega', 'cupons', 'clientes', 'relatorios', 'whatsapp', 'loja']) {
  await admin.goto(`${BASE}/admin/#${r}`);
  await admin.waitForTimeout(250);
  if (['pdv', 'cardapio', 'relatorios'].includes(r)) await admin.screenshot({ path: `${SHOTS}/7-${r}.png` });
}
ok(true, 'todas as telas do painel abriram');

// PDV: lança pedido de balcão
await admin.goto(`${BASE}/admin/#pdv`);
await admin.waitForSelector('.pdv-prod');
await admin.locator('.pdv-prod', { hasText: 'Batata Simples' }).click();
admin.once('dialog', (d) => d.dismiss());
await admin.click('#pdvLancar');
await admin.waitForTimeout(400);
await admin.goto(`${BASE}/admin/#pedidos`);
await admin.waitForTimeout(300);
ok((await admin.locator('.card-ped').count()) === 2, 'pedido de balcão lançado pelo PDV');

ok(erros.length === 0, 'nenhum erro de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close();
console.log('\nTudo certo!');
