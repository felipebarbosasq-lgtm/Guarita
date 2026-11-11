#!/usr/bin/env node
/* Testes de ponta a ponta (Chromium/Playwright) com o ambiente local de tests/local-supabase.
   Uso: tests/local-supabase/setup.sh && node tests/local-supabase/server.mjs &  node tests/e2e.mjs
   Gera capturas de tela em tests/screens/. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.SITE || 'http://127.0.0.1:8888';
const SHOTS = path.join(ROOT, 'tests/screens'); fs.mkdirSync(SHOTS, { recursive: true });
const FIX = '/tmp/guarita-fixtures'; fs.mkdirSync(FIX, { recursive: true });
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) { passes++; console.log('  ✓ ' + msg); } else { fails++; console.log('  ✗ FALHOU: ' + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* fotos de teste geradas na hora (só para o imóvel de teste, apagado ao final) */
execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw
for i,(w,h,c) in enumerate([(3000,2000,(40,90,140)),(2400,1600,(150,110,60)),(1600,2400,(60,120,80)),(4032,3024,(120,60,90))],1):
    im=Image.new('RGB',(w,h),c); d=ImageDraw.Draw(im)
    for k in range(0,w,200): d.line([(k,0),(k,h)],fill=(255,255,255),width=6)
    d.ellipse([w*.3,h*.3,w*.7,h*.7],fill=(230,200,120)); im.save('${FIX}/foto%d.jpg'%i,quality=90)
Image.new('RGB',(500,400),(0,0,0)).save('${FIX}/pequena.jpg')
open('${FIX}/texto.jpg','w').write('isto não é uma imagem')
`]);

const browser = await chromium.launch();
const errors = [];
async function page(ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...ctxOpts });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`${p.url()} → ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|formsubmit|google|ERR_NAME|ERR_INTERNET|ERR_CONNECTION|ERR_TUNNEL|net::ERR/i.test(m.text()) && !(p.url().startsWith('file:') && /Access to font at 'file:/.test(m.text())) && !p.__expectHttpErrors) errors.push(`${p.url()} → console: ${m.text()}`); });
  await p.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  return { ctx, p };
}
const noHScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

/* ================= 1. visualização local (file://, sem servidor, modo demonstração) ================= */
console.log('\n1. index.html aberto direto do disco (modo demonstração)');
{
  const { ctx, p } = await page();
  await p.goto('file://' + path.join(ROOT, 'public/index.html'));
  await p.waitForSelector('#car .prop:not(.skel)');
  ok(await p.locator('.hero .slide').count() === 4, 'abertura com exatamente 4 fotos');
  await p.evaluate(() => document.fonts.ready);
  ok(await p.evaluate(() => ['Cormorant Garamond', 'Jost'].every(n => [...document.fonts].some(f => f.family.replace(/"/g, '') === n && f.status === 'loaded'))), 'fontes originais carregadas mesmo abrindo do disco');
  ok(await p.locator('.hero h1').innerText() === 'Guarita\nImobiliária' || (await p.locator('.hero h1').innerText()).replace(/\s+/g, ' ') === 'Guarita Imobiliária', 'título "Guarita Imobiliária" mantido');
  ok((await p.locator('.slogan').innerText()) === 'A imobiliária da sua família.', 'slogan mantido');
  ok(await p.locator('.hero .cta a', { hasText: 'Ver imóveis' }).count() === 1 && await p.locator('.hero .cta a', { hasText: 'Falar com um especialista' }).count() === 1, 'dois botões originais');
  const loaded = await p.evaluate(() => [...document.querySelectorAll('.hero .slide img')].map(i => i.currentSrc.split('/').pop()));
  ok(loaded.every(s => /\.webp$/.test(s)) && !loaded.some(s => /eleganza|^skyline-(m-)?\d/.test(s)), 'sem fotos internas no banner: ' + loaded.join(', '));
  ok(await p.locator('#car .prop').count() === 1 && await p.locator('#car').evaluate(e => e.classList.contains('static')), 'um imóvel cadastrado → cartão fixo (sem carrossel girando um único cartão)');
  ok(await p.locator('text=Procura algo diferente?').count() === 0 && await p.locator('text=Sob medida').count() === 0, 'quadro "Procura algo diferente?/Sob medida" removido');
  const card = await p.locator('#car .prop').innerText();
  ok(/CENTRO · BALNEÁRIO CAMBORIÚ/i.test(card) && card.includes('Eleganza Tower') && card.includes('Apartamento 4200 · Rua 1101, 140') && card.includes('4 dormitórios, 2 suítes') && card.includes('3 vagas') && card.includes('140 m² privativos') && card.includes('R$ 7.519.000,00') && card.includes('14 fotos'), 'cartão com todos os dados originais');
  ok(await p.locator('[role=tab]').allInnerTexts().then(t => t.join('|')) === 'Comprar|Alugar|Anunciar meu imóvel', 'abas: Comprar | Alugar | Anunciar meu imóvel');
  const tw = await p.locator('[role=tab]').evaluateAll(t => t.map(x => Math.round(x.getBoundingClientRect().width)));
  ok(Math.max(...tw) - Math.min(...tw) <= 1, 'abas com larguras iguais ' + tw.join('/'));
  ok(await p.locator('#p-comprar input[value="Tanto faz"]').count() === 0 && await p.locator('#p-comprar input[name="Imóvel"]').count() === 2, 'botão "Tanto faz" removido; restam Na planta | Pronto');
  ok(await p.locator('text=Jeferson').count() === 0 && await p.locator('text=Jefferson Monteiro').count() >= 1, 'nome Jefferson correto');
  // formulário Comprar
  await p.locator('#atendimento').scrollIntoViewIfNeeded();
  await p.click('#p-comprar button[type=submit]');
  ok(await p.locator('#p-comprar .err:not(:empty)').count() >= 5, 'Comprar valida campos obrigatórios (inclui Imóvel)');
  await p.fill('#c-nome', 'Maria Teste'); await p.fill('#c-wa', '47999998888'); await p.selectOption('#c-reg', 'Itapema'); await p.selectOption('#c-val', 'R$ 4 a 6 milhões');
  await p.click('#p-comprar label.chip:has-text("Pronto")'); await p.check('#p-comprar [name=consent]');
  await p.click('#p-comprar button[type=submit]');
  const opened = await p.evaluate(() => window.__opened[0] || '');
  const txt = decodeURIComponent(opened.split('text=')[1] || '');
  ok(opened.startsWith('https://wa.me/554791127088?') && txt.includes('Interesse: Compra') && txt.includes('Imóvel: Pronto') && txt.includes('WhatsApp: (47) 99999-8888'), 'Comprar envia pelo WhatsApp da Guarita');
  for (const [tab, tipo, fill] of [['#tab-alugar', 'Locação', async () => { await p.fill('#a-nome', 'João'); await p.fill('#a-wa', '4733334444'); await p.selectOption('#a-reg', 'Porto Belo'); await p.selectOption('#a-tipo', 'Casa'); await p.check('#p-alugar [name=consent]'); }],
    ['#tab-anunciar', 'Administração de imóvel para locação', async () => { await p.fill('#n-nome', 'Ana'); await p.fill('#n-wa', '47988887777'); await p.selectOption('#n-cid', 'Itapema'); await p.selectOption('#n-tipo', 'Apartamento'); await p.check('#p-anunciar [name=consent]'); }]]) {
    await p.locator(tab).evaluate(e => e.scrollIntoView({ block: 'center' })); await p.click(tab); const pid = tab.replace('#tab-', '#p-');
    await p.click(`${pid} button[type=submit]`);
    ok(await p.locator(`${pid} .err:not(:empty)`).count() >= 4, `${tipo}: valida antes de enviar`);
    await fill(); await p.click(`${pid} button[type=submit]`);
    const u = await p.evaluate(() => window.__opened[window.__opened.length - 1]);
    ok(decodeURIComponent(u).includes('Interesse: ' + tipo), `${tipo}: envia pelo WhatsApp`);
  }
  ok(await p.locator('input[type=email]').count() === 0, 'nenhum campo de e-mail nos formulários');
  // página do imóvel local
  await p.locator('#car .prop a.btn').click();
  await p.waitForSelector('#im:not([hidden])');
  ok(p.url().includes('imovel/index.html?i=eleganza-tower-apartamento-4200'), '“Ver imóvel” abre a página do imóvel (local)');
  ok((await p.locator('#im-nome').innerText()) === 'Eleganza Tower' && (await p.locator('#im-preco').innerText()) === 'R$ 7.519.000,00', 'página do imóvel com nome e preço');
  const wa = decodeURIComponent((await p.locator('#im-wa').getAttribute('href')).split('text=')[1]);
  ok(wa === 'Olá, Guarita Imobiliária! Gostaria de receber mais informações sobre o imóvel Eleganza Tower, apartamento 4200, referência GUA-0001.', 'WhatsApp do imóvel com nome e código: ' + wa);
  await p.click('#gal .g0'); await p.waitForSelector('#lb.on');
  ok(await p.locator('#tb button').count() === 14, 'galeria completa com 14 fotos');
  await p.keyboard.press('ArrowRight'); ok((await p.locator('#ln').innerText()) === '2 / 14', 'galeria navega pelo teclado');
  await p.keyboard.press('Escape');
  await ctx.close();
}

/* ================= 2. site publicado (servidor com regras do Netlify + banco) ================= */
console.log('\n2. Site com banco de dados (rotas do Netlify)');
{
  const { ctx, p } = await page();
  await p.goto(SITE + '/');
  await p.waitForSelector('#car .prop:not(.skel)');
  ok(await p.locator('#car .prop:not([aria-hidden])').count() === 1, 'carrossel carregado do banco');
  await p.locator('#car .prop a.btn').first().click();
  await p.waitForSelector('#im:not([hidden])');
  ok(new URL(p.url()).pathname === '/imovel/eleganza-tower-apartamento-4200', 'URL amigável /imovel/eleganza-tower-apartamento-4200');
  ok((await p.title()).startsWith('Eleganza Tower 4200'), 'título da página do imóvel');
  p.__expectHttpErrors = true; await p.goto(SITE + '/imovel/nao-existe'); await p.waitForSelector('#im-404:not([hidden])'); p.__expectHttpErrors = false;
  ok(true, 'imóvel inexistente mostra aviso');
  const sm = await (await p.request.get(SITE + '/sitemap.xml')).text();
  ok(sm.includes('/imovel/eleganza-tower-apartamento-4200'), 'sitemap lista os imóveis publicados');
  await ctx.close();
}

/* ================= 3. painel administrativo ================= */
console.log('\n3. Painel administrativo');
let novoSlug = '';
{
  const { ctx, p } = await page();
  p.on('dialog', d => d.accept());
  await p.goto(SITE + '/admin');
  ok(new URL(p.url()).pathname === '/admin/', '/admin redireciona para /admin/');
  await p.waitForSelector('#v-login:not([hidden])');
  ok(true, 'painel exige login');
  ok(await p.evaluate(() => ['v-boot', 'v-nocfg', 'v-login', 'v-denied', 'v-app', 'f-reset'].filter(id => getComputedStyle(document.getElementById(id)).display !== 'none').join()) === 'v-login', 'só a tela de login fica visível');
  const html = await (await p.request.get(SITE + '/')).text();
  ok(!/href="[^"]*admin/.test(html), 'painel não aparece na navegação pública');
  p.__expectHttpErrors = true; // as próximas etapas provocam recusas de propósito
  await p.fill('#l-email', 'admin@teste.local'); await p.fill('#l-pass', 'senha-errada'); await p.click('#f-login button[type=submit]');
  await p.waitForSelector('#l-err:not(:empty)'); ok((await p.locator('#l-err').innerText()).includes('incorretos'), 'senha errada é recusada');
  await p.fill('#l-email', 'intruso@teste.local'); await p.fill('#l-pass', 'senha-intruso-123'); await p.click('#f-login button[type=submit]');
  await p.waitForSelector('#v-denied:not([hidden])'); ok(true, 'usuário sem autorização é barrado');
  // mesmo burlando a tela, o banco recusa gravações do não-admin
  const forged = await p.evaluate(async () => {
    const c = window.GUARITA_CONFIG, s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.includes('auth-token'))));
    const r = await fetch(c.supabaseUrl + '/rest/v1/imoveis', { method: 'POST', headers: { apikey: c.supabaseAnonKey, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'invasao', nome: 'Invasão', cidade: 'X' }) });
    const r2 = await fetch(c.supabaseUrl + '/rest/v1/imoveis', { method: 'POST', headers: { apikey: c.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'invasao2', nome: 'Invasão', cidade: 'X' }) });
    return [r.status, r2.status];
  });
  ok(forged[0] === 403 && forged[1] === 401, 'API recusa cadastro de não-admin (403) e de visitante (401): ' + forged);
  p.__expectHttpErrors = false;
  await p.click('#v-denied [data-logout]'); await p.waitForSelector('#v-login:not([hidden])');
  await p.fill('#l-email', 'admin@teste.local'); await p.fill('#l-pass', 'senha-admin-123'); await p.click('#f-login button[type=submit]');
  await p.waitForSelector('#v-app:not([hidden])'); await p.waitForSelector('#list .row');
  ok(await p.locator('#list .row').count() === 1, 'admin vê a lista de imóveis');
  await p.screenshot({ path: path.join(SHOTS, 'admin-lista.png') });

  // cadastro completo com fotos
  await p.click('#b-new');
  await p.fill('#e-nome', 'Residencial Teste Mar'); await p.fill('#e-tipo', 'Cobertura'); await p.fill('#e-complemento', '1801');
  await p.fill('#e-endereco', 'Avenida Atlântica, 1000'); await p.fill('#e-bairro', 'Barra Sul'); await p.fill('#e-cidade', 'Balneário Camboriú');
  await p.fill('#e-valor', '12.500.000,00'); await p.fill('#e-area_privativa', '320,5'); await p.fill('#e-area_total', '480');
  await p.fill('#e-dormitorios', '5'); await p.fill('#e-suites', '6'); await p.fill('#e-banheiros', '7'); await p.fill('#e-vagas', '4');
  await p.fill('#e-descricao', 'Cobertura de teste.\n\nSegundo parágrafo.'); await p.fill('#e-caracteristicas', 'Vista para o mar\nPiscina privativa');
  await p.check('#e-publicado', { force: true });
  await p.click('#b-save');
  ok((await p.locator('#e-suites ~ .err').innerText()).includes('maior'), 'validação: suítes > dormitórios');
  ok((await p.locator('#e-err').innerText()).length > 0, 'validação: não publica sem foto');
  await p.fill('#e-suites', '3');
  await p.setInputFiles('#e-files', [`${FIX}/foto1.jpg`, `${FIX}/foto2.jpg`, `${FIX}/foto3.jpg`, `${FIX}/foto4.jpg`, `${FIX}/pequena.jpg`, `${FIX}/texto.jpg`]);
  await p.waitForFunction(() => document.querySelectorAll('#photos .ph-i').length === 4 && !document.querySelector('#photos .prog'), null, { timeout: 60000 });
  ok(await p.locator('#photos .ph-i').count() === 4, 'várias fotos de uma vez: 4 aceitas');
  const perr = await p.locator('#ph-err').innerText();
  ok(/pequena\.jpg: resolução baixa/.test(perr) && /texto\.jpg/.test(perr), 'fotos pequenas ou inválidas recusadas com aviso: ' + perr);
  // capa: escolher a 3ª foto (vertical) como capa
  await p.locator('#photos .ph-i').nth(2).locator('[data-p=cover]').click();
  ok(await p.locator('#photos .ph-i').first().locator('.cap').count() === 1, 'foto escolhida virou capa');
  await p.locator('#pv .prop').waitFor();
  ok((await p.locator('#pv .prop').innerText()).includes('R$ 12.500.000,00'), 'pré-visualização do cartão com valor formatado');
  await p.click('#b-save');
  await p.waitForSelector('#toast.on');
  const t = await p.locator('#toast').innerText();
  ok(/Imóvel cadastrado \(GUA-\d{4}\)/.test(t), 'imóvel salvo com código automático: ' + t);
  novoSlug = await p.inputValue('#e-slug');
  ok(novoSlug === 'residencial-teste-mar-cobertura-1801', 'endereço da página gerado: ' + novoSlug);
  const saved = await p.evaluate(async () => (await (await fetch(document.querySelector('#pv img').src)).blob()).type);
  ok(saved === 'image/webp', 'fotos otimizadas em WebP');
  const dims = await p.evaluate(() => { const i = document.querySelector('#pv img'); return [i.naturalWidth, i.naturalHeight]; });
  ok(dims[0] <= 960 && Math.abs(dims[0] / dims[1] - 1600 / 2400) < .01, 'proporção original preservada (sem distorção): ' + dims);
  await p.screenshot({ path: path.join(SHOTS, 'admin-editor.png'), fullPage: true });

  // mais imóveis para testar o carrossel
  for (const [nome, cidade, valor] of [['Teste Dois', 'Itapema', '3.200.000'], ['Teste Três', 'Porto Belo', '2.100.000'], ['Teste Quatro', 'Itajaí', '1.800.000']]) {
    await p.click('#b-back'); await p.click('#b-new');
    await p.fill('#e-nome', nome); await p.fill('#e-cidade', cidade); await p.fill('#e-valor', valor); await p.fill('#e-dormitorios', '3'); await p.fill('#e-vagas', '2');
    await p.setInputFiles('#e-files', [`${FIX}/foto${1 + Math.floor(Math.random() * 4)}.jpg`]);
    await p.waitForFunction(() => document.querySelectorAll('#photos .ph-i').length === 1 && !document.querySelector('#photos .prog'), null, { timeout: 30000 });
    await p.check('#e-publicado', { force: true }); await p.click('#b-save'); await p.waitForSelector('#b-del:not([hidden])');
  }
  await p.click('#b-back');
  ok(await p.locator('#list .row').count() === 5, 'lista com 5 imóveis');
  // pesquisa
  await p.fill('#q', 'itapema'); ok(await p.locator('#list .row').count() === 1, 'pesquisa por cidade (sem acento)');
  await p.fill('#q', 'gua-0001'); ok(await p.locator('#list .row').count() === 1, 'pesquisa por código');
  await p.fill('#q', '');
  // reordenar
  const before = await p.locator('#list .row .nm b').allInnerTexts();
  await p.locator('#list .row').nth(2).locator('[data-act=up]').click(); await p.waitForSelector('#toast.on');
  const after = await p.locator('#list .row .nm b').allInnerTexts();
  ok(after[1] === before[2] && after[2] === before[1], 'reorganiza a ordem');
  // despublicar / destaque
  const quatro = p.locator('#list .row', { hasText: 'Teste Quatro' });
  await quatro.locator('[data-act=pub]').click(); await p.waitForFunction(() => [...document.querySelectorAll('#list .row')].some(r => r.innerText.includes('Teste Quatro') && r.querySelector('[data-act=pub]').getAttribute('aria-pressed') === 'false'));
  ok(true, 'despublicar pela lista');
  await p.reload(); await p.waitForSelector('#list .row');
  const after2 = await p.locator('#list .row .nm b').allInnerTexts();
  ok(JSON.stringify(after2) === JSON.stringify(after), 'ordem e dados persistem após recarregar');
  await ctx.close();
}

/* ================= 4. carrossel com vários imóveis ================= */
console.log('\n4. Carrossel automático');
for (const [label, opts, per] of [['computador', { viewport: { width: 1440, height: 900 } }, 3], ['tablet', { viewport: { width: 820, height: 1180 }, hasTouch: true }, 2], ['celular', { ...devices['iPhone 13'] }, 1]]) {
  const { ctx, p } = await page(opts);
  await p.goto(SITE + '/#imoveis'); await p.waitForSelector('#car .prop:not(.skel)');
  await p.locator('#car').scrollIntoViewIfNeeded(); await sleep(400);
  const names = await p.locator('#car .prop:not([aria-hidden]) h3').allInnerTexts();
  ok(names.length === 4 && !names.includes('Teste Quatro'), `${label}: só imóveis publicados (${names.length})`);
  const vis = await p.evaluate(() => { const vp = document.querySelector('.car-vp').getBoundingClientRect(); return [...document.querySelectorAll('#car .prop')].filter(c => { const r = c.getBoundingClientRect(); return r.left >= vp.left - 2 && r.right <= vp.right + 2; }).length; });
  ok(Math.abs(vis - per) <= 1, `${label}: ${vis} cartão(ões) inteiros visíveis (esperado ~${per})`);
  const hs = await p.locator('#car .prop').evaluateAll(cs => [...new Set(cs.map(c => Math.round(c.getBoundingClientRect().height)))]);
  ok(hs.length === 1, `${label}: cartões padronizados com mesma altura ${hs}`);
  const tx = () => p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.car-track')).transform).m41);
  const a = await tx(); await sleep(1500); const b = await tx();
  ok(b > a + 10, `${label}: anda sozinho da esquerda para a direita (${a.toFixed(0)} → ${b.toFixed(0)})`);
  // gesto de arrastar
  const box = await p.locator('.car-vp').boundingBox();
  const c0 = await tx();
  if (opts.hasTouch) {
    const cdp = await ctx.newCDPSession(p);
    const y = box.y + box.height / 3, x0 = box.x + box.width * .8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - k * 22, y }] }); await sleep(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await p.mouse.move(box.x + box.width * .7, box.y + box.height / 3); await p.mouse.down();
    for (let k = 1; k <= 10; k++) { await p.mouse.move(box.x + box.width * .7 - k * 25, box.y + box.height / 3); await sleep(16); }
    await p.mouse.up(); await p.mouse.move(5, 5);
  }
  await sleep(150);
  const c1 = await tx();
  ok(c1 < c0 - 100, `${label}: arrastar com ${opts.hasTouch ? 'o dedo' : 'o mouse'} move o carrossel (${c0.toFixed(0)} → ${c1.toFixed(0)})`);
  await sleep(700); const d0 = await tx(); await sleep(800); const d1 = await tx();
  ok(Math.abs(d1 - d0) < 3, `${label}: pausa depois da interação`);
  await sleep(4200); const e0 = await tx(); await sleep(1000); const e1 = await tx();
  ok(e1 > e0 + 5, `${label}: retoma o movimento sozinho`);
  if (label === 'computador') {
    const n0 = await tx(); await p.click('.car-next'); await sleep(900); const n1 = await tx();
    ok(n1 < n0 - 200, 'setas discretas navegam');
    const w0 = await tx(); await p.mouse.move(box.x + 200, box.y + 100); await p.mouse.wheel(300, 0); await sleep(100); const w1 = await tx();
    ok(w1 < w0 - 100, 'rolagem horizontal do touchpad navega');
    // loop sem saltos: o deslocamento fica sempre dentro da faixa e nunca há espaço vazio
    const gaps = await p.evaluate(async () => { const vp = document.querySelector('.car-vp').getBoundingClientRect(); let bad = 0; for (let k = 0; k < 40; k++) { await new Promise(r => setTimeout(r, 50)); const cs = [...document.querySelectorAll('#car .prop')].map(c => c.getBoundingClientRect()); if (!cs.some(r => r.left <= vp.left + 1) || !cs.some(r => r.right >= vp.right - 1)) bad++; } return bad; });
    ok(gaps === 0, 'loop infinito sem espaços vazios');
    const vb = await p.evaluate(() => { const vp = document.querySelector('.car-vp').getBoundingClientRect(); const a = [...document.querySelectorAll('#car .prop a.btn')].find(x => { const r = x.getBoundingClientRect(); return r.left > vp.left + 40 && r.right < vp.right - 40; }); a.dataset.alvo = '1'; return a.closest('.prop').hasAttribute('aria-hidden'); });
    await p.mouse.move(box.x + box.width / 2, box.y + 40); await sleep(1500); // mouse sobre o carrossel: ele desacelera e para
    await p.click('#car a[data-alvo]');
    await p.waitForURL(/\/imovel\//); ok(true, `clique em "Ver imóvel" no carrossel abre a página (cartão ${vb ? 'cópia do loop' : 'original'})`);
  }
  ok(await noHScroll(p), `${label}: sem rolagem horizontal`);
  await ctx.close();
}
// movimento reduzido
{
  const { ctx, p } = await page({ reducedMotion: 'reduce' });
  await p.goto(SITE + '/'); await p.waitForSelector('#car .prop:not(.skel)'); await p.locator('#car').scrollIntoViewIfNeeded();
  const t = () => p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.car-track')).transform).m41);
  const a = await t(); await sleep(1500); const b = await t();
  ok(Math.abs(a - b) < 1, 'movimento reduzido: carrossel não anda sozinho');
  const anim = await p.evaluate(() => getComputedStyle(document.querySelector('.slide.on img')).animationName);
  ok(anim === 'none', 'movimento reduzido: sem zoom no banner');
  await ctx.close();
}

/* ================= 5. banner ================= */
console.log('\n5. Banner cinematográfico');
{
  const { ctx, p } = await page();
  await p.goto(SITE + '/');
  await p.waitForFunction(() => [...document.querySelectorAll('.hero .slide img')].every(i => i.complete && i.naturalWidth));
  const order = [];
  const t0 = Date.now();
  // amostra o brilho do centro do banner para garantir que nunca fica preto durante as trocas
  let minOpacity = 1;
  while (Date.now() - t0 < 14500) {
    const s = await p.evaluate(() => { const on = document.querySelector('.slide.on'), prev = document.querySelector('.slide.prev'); return { k: [...document.querySelectorAll('.slide')].indexOf(on), cover: Math.max(+getComputedStyle(on).opacity, prev ? +getComputedStyle(prev).opacity : 0) }; });
    if (order[order.length - 1] !== s.k) order.push(s.k);
    minOpacity = Math.min(minOpacity, s.cover);
    await sleep(120);
  }
  ok(order.length >= 3 && order[0] === 0 && order[1] === 1 && order[2] === 2, 'troca automática a cada ~6 s: ' + order.join('→'));
  ok(minOpacity > .99, 'sem tela preta entre as fotos (cobertura mínima ' + minOpacity.toFixed(2) + ')');
  const anim = await p.evaluate(() => getComputedStyle(document.querySelector('.slide.on img')).animationName);
  ok(anim === 'kb', 'zoom cinematográfico discreto ativo');
  await ctx.close();
}

/* ================= 6. responsividade e capturas ================= */
console.log('\n6. Responsividade');
const VIEWS = [['desktop-1920', { viewport: { width: 1920, height: 1080 } }], ['desktop-4k', { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 }], ['notebook-1366', { viewport: { width: 1366, height: 768 } }],
  ['tablet-ipad', devices['iPad (gen 7)']], ['iphone-13', devices['iPhone 13']], ['android-pixel7', devices['Pixel 7']], ['android-pequeno-360', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }]];
for (const [name, opts] of VIEWS) {
  const { ctx, p } = await page({ ...opts, reducedMotion: 'reduce' });
  await p.goto(SITE + '/'); await p.waitForSelector('#car .prop:not(.skel)');
  await p.waitForFunction(() => document.querySelector('.slide.on img').complete);
  const src = await p.evaluate(() => document.querySelector('.slide.on img').currentSrc.split('/').pop());
  const mobile = (opts.viewport.width / opts.viewport.height) <= .8;
  ok(mobile ? src.includes('-m-') : !src.includes('-m-'), `${name}: foto ${mobile ? 'vertical' : 'horizontal'} adequada (${src})`);
  ok(await noHScroll(p), `${name}: sem rolagem horizontal`);
  const overlap = await p.evaluate(() => { const h = document.querySelector('.hero h1').getBoundingClientRect(), b = document.querySelector('.hero .cta').getBoundingClientRect(), s = document.querySelector('.slogan').getBoundingClientRect(); return h.bottom <= s.top + 1 && s.bottom <= b.top + 1 && b.bottom <= innerHeight; });
  ok(overlap, `${name}: título, slogan e botões sem sobreposição e dentro da tela`);
  const small = await p.evaluate(() => [...document.querySelectorAll('a.btn, button.btn, .chip span, .tab, .burger')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 40).length);
  ok(small === 0, `${name}: botões com área de toque ≥ 40 px`);
  await p.screenshot({ path: path.join(SHOTS, `${name}-inicio.png`) });
  await p.evaluate(() => { document.querySelectorAll('.rv').forEach(e => e.classList.add('in')); });
  await p.locator('#imoveis').scrollIntoViewIfNeeded(); await sleep(200);
  await p.screenshot({ path: path.join(SHOTS, `${name}-imoveis.png`) });
  await p.locator('#atendimento').scrollIntoViewIfNeeded(); await sleep(200);
  await p.screenshot({ path: path.join(SHOTS, `${name}-atendimento.png`) });
  if (opts.isMobile) {
    await p.evaluate(() => scrollTo(0, 0)); await p.click('#bg'); await sleep(300);
    ok(await p.locator('#nv.open').isVisible(), `${name}: menu mobile abre`);
    await p.screenshot({ path: path.join(SHOTS, `${name}-menu.png`) });
    await p.click('#nv a[href="#atendimento"]'); await sleep(300);
    ok(!(await p.locator('#nv.open').count()), `${name}: menu fecha ao escolher`);
  }
  await p.goto(SITE + '/imovel/' + novoSlug); await p.waitForSelector('#im:not([hidden])');
  ok(await noHScroll(p), `${name}: página do imóvel sem rolagem horizontal`);
  await p.screenshot({ path: path.join(SHOTS, `${name}-imovel.png`), fullPage: !opts.isMobile });
  await ctx.close();
}

/* ================= 7. limpeza: exclui os imóveis de teste pelo painel ================= */
console.log('\n7. Exclusão');
{
  const { ctx, p } = await page();
  await p.goto(SITE + '/admin/'); await p.waitForSelector('#v-login:not([hidden]), #v-app:not([hidden])');
  if (await p.locator('#v-login:not([hidden])').count()) { await p.fill('#l-email', 'admin@teste.local'); await p.fill('#l-pass', 'senha-admin-123'); await p.click('#f-login button[type=submit]'); }
  await p.waitForSelector('#list .row');
  const files0 = fs.readdirSync('/tmp/guarita-storage/imoveis', { recursive: true }).filter(f => f.endsWith('.webp')).length;
  while (await p.locator('#list .row', { hasText: 'Teste' }).count()) {
    await p.locator('#list .row', { hasText: 'Teste' }).first().locator('[data-act=del]').click();
    await p.waitForSelector('#modal:not([hidden])');
    ok((await p.locator('#m-t').innerText()).startsWith('Excluir'), 'pede confirmação antes de excluir');
    const n = await p.locator('#list .row').count();
    await p.click('#m-yes'); await p.waitForFunction(n => document.querySelectorAll('#list .row').length === n - 1, n);
  }
  const files1 = fs.readdirSync('/tmp/guarita-storage/imoveis', { recursive: true }).filter(f => f.endsWith('.webp')).length;
  ok(files0 > 0 && files1 === 0, `fotos apagadas do armazenamento junto com o imóvel (${files0} → ${files1})`);
  ok(await p.locator('#list .row').count() === 1, 'restou apenas o Eleganza Tower');
  await ctx.close();
}

await browser.close();
console.log(`\nErros de JavaScript no console: ${errors.length}`); errors.forEach(e => console.log('  ' + e));
if (errors.length) fails++;
console.log(`\n${passes} verificações OK, ${fails} falhas.`);
process.exit(fails ? 1 : 0);
