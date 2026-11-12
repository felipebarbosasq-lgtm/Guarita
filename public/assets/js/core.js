/* Guarita Imobiliária: funções compartilhadas pelo site público (início e página do imóvel). */
(function () {
'use strict';
const CONFIG = window.GUARITA_CONFIG || {};
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wa = t => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(t)}`;
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hasDB = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);

/* raiz do site, descoberta pelo endereço deste próprio arquivo (funciona no servidor e aberto do disco).
   Imagens do site são relativas à raiz; fotos enviadas pelo painel são URLs completas. */
const ROOT = (document.currentScript && document.currentScript.src || location.href).replace(/assets\/js\/core\.js.*$/, '');
const src = p => !p ? '' : /^(https?:|data:|blob:)/.test(p) ? p : ROOT + p.replace(/^\//, '');
const imovelUrl = im => CONFIG.prettyUrls && location.protocol !== 'file:'
  ? `/imovel/${encodeURIComponent(im.slug)}` : `${ROOT}imovel/index.html?i=${encodeURIComponent(im.slug)}`;

/* formatação padronizada (igual para todos os imóveis, cadastrados por qualquer pessoa) */
const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const brl = v => 'R$ ' + new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const n = v => v === null || v === undefined || v === '' ? null : Number(v);
const plural = (q, um, varios) => `${q} ${q === 1 ? um : varios}`;
const STATUS = { disponivel: '', reservado: 'Reservado', vendido: 'Vendido', alugado: 'Alugado' };
const fmt = {
  price(im) { const v = n(im.valor); return v ? brl(v) + (im.finalidade === 'locacao' ? '/mês' : '') : 'Sob consulta'; },
  priceLabel(im) { return im.finalidade === 'locacao' ? 'Aluguel' : 'Valor'; },
  area(v) { return nf.format(v) + ' m²'; },
  loc(im) { return [im.bairro, im.cidade].filter(Boolean).join(' · '); },
  unit(im) { return [[im.tipo, im.complemento].filter(Boolean).join(' '), im.endereco].filter(Boolean).join(' · '); },
  title(im) { return [im.nome, [im.tipo, im.complemento].filter(Boolean).join(' ').toLowerCase()].filter(Boolean).join(', '); },
  status(im) { return STATUS[im.status] || ''; },
  /* linha de características do cartão: "4 dormitórios, 2 suítes · 3 vagas · 140 m² privativos" */
  specs(im) {
    const out = [], d = n(im.dormitorios), s = n(im.suites), g = n(im.vagas), a = n(im.area_privativa);
    if (d) out.push(`<li><b>${d}</b> ${d === 1 ? 'dormitório' : 'dormitórios'}${s ? ', ' + plural(s, 'suíte', 'suítes') : ''}</li>`);
    else if (s) out.push(`<li><b>${s}</b> ${s === 1 ? 'suíte' : 'suítes'}</li>`);
    if (g) out.push(`<li><b>${g}</b> ${g === 1 ? 'vaga' : 'vagas'}</li>`);
    if (a) out.push(`<li><b>${fmt.area(a)}</b> privativos</li>`);
    return out.join('');
  }
};

/* cartão do imóvel: mesmo HTML para os imóveis originais e os cadastrados no painel */
function card(im) {
  const f = (im.fotos || [])[0], url = imovelUrl(im), total = (im.fotos || []).length, st = fmt.status(im);
  const alt = (f && f.alt) || `${fmt.title(im)}: foto principal`;
  const img = f ? `<img src="${esc(src(f.md || f.lg))}" srcset="${esc(src(f.md || f.lg))} 720w, ${esc(src(f.lg || f.md))} 1280w" sizes="(max-width:640px) 88vw, (max-width:1080px) 46vw, 390px" alt="${esc(alt)}" width="${f.w || 1280}" height="${f.h || 853}" loading="lazy" decoding="async" draggable="false">` : '';
  return `<article class="prop" data-id="${esc(im.id)}">
    <a class="ph" href="${esc(url)}" tabindex="-1" aria-hidden="true" draggable="false">${img}${total > 1 ? `<span class="tag">${total} fotos</span>` : ''}${st ? `<span class="st-badge">${st}</span>` : ''}</a>
    <div class="bd">
     <span class="loc">${esc(fmt.loc(im))}</span>
     <h3>${esc(im.nome)}</h3>
     <p class="unit">${esc(fmt.unit(im))}</p>
     <ul class="specs" aria-label="Características">${fmt.specs(im)}</ul>
     <div class="ft">
      <p class="price"><small>${fmt.priceLabel(im)}</small>${esc(fmt.price(im))}</p>
      <a class="btn" href="${esc(url)}" draggable="false" aria-label="Ver imóvel: ${esc(fmt.title(im))}">Ver imóvel</a>
     </div>
    </div>
   </article>`;
}

/* dados: Supabase (API REST pública, só leitura de anúncios publicados) ou demonstração local */
const COLS = 'id,slug,codigo,nome,tipo,complemento,finalidade,endereco,bairro,cidade,estado,valor,area_privativa,area_total,dormitorios,suites,banheiros,vagas,descricao,caracteristicas,info_complementar,status,publicado,destaque,ordem,fotos,updated_at';
async function rest(q) {
  const r = await fetch(`${CONFIG.supabaseUrl.replace(/\/$/, '')}/rest/v1/imoveis?${q}`, {
    // chave antiga "anon" (JWT, começa com eyJ) vai também como Bearer; a nova "publishable" (sb_publishable_…) só no apikey
    headers: { apikey: CONFIG.supabaseAnonKey, ...(/^eyJ/.test(CONFIG.supabaseAnonKey) ? { Authorization: `Bearer ${CONFIG.supabaseAnonKey}` } : {}), Accept: 'application/json' }
  });
  if (!r.ok) throw new Error('Falha ao carregar imóveis (' + r.status + ')');
  return r.json();
}
const sortList = l => l.slice().sort((a, b) => (b.destaque === true) - (a.destaque === true) || (a.ordem || 0) - (b.ordem || 0));
const data = {
  hasDB,
  async list() {
    if (!hasDB) return sortList((window.GUARITA_DEMO || []).filter(i => i.publicado));
    return rest(`select=${COLS}&publicado=eq.true&order=destaque.desc,ordem.asc,created_at.desc`);
  },
  async get(slug) {
    if (!hasDB) return (window.GUARITA_DEMO || []).find(i => i.slug === slug && i.publicado) || null;
    const l = await rest(`select=${COLS}&publicado=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    return l[0] || null;
  }
};

/* contatos, cabeçalho, menu e botão flutuante */
function chrome() {
  $$('[data-wa]').forEach(a => a.href = wa(CONFIG.waHello));
  $$('[data-mail]').forEach(a => { a.href = 'mailto:' + CONFIG.email; a.textContent = CONFIG.email; });
  $$('[data-ig]').forEach(a => a.href = CONFIG.instagram);
  $$('[data-creci]').forEach(s => s.textContent = CONFIG.creci);
  const fw = $('#fw'); if (fw) fw.textContent = 'WhatsApp ' + CONFIG.whatsapp.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '+55 ($1) $2-$3');
  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();
  const hd = $('#hd'), nv = $('#nv'), bg = $('#bg'), fab = $('.wa'), solid = hd && hd.classList.contains('solid'); let tk = false;
  function onScroll() { const y = scrollY; hd.classList.toggle('s', solid || y > 40); if (fab) fab.classList.toggle('on', y > innerHeight * .6 || solid); tk = false; }
  addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(onScroll); } }, { passive: true }); onScroll();
  function menu(o) { nv.classList.toggle('open', o); bg.setAttribute('aria-expanded', o); bg.setAttribute('aria-label', o ? 'Fechar menu' : 'Abrir menu'); document.body.style.overflow = o ? 'hidden' : ''; }
  bg.onclick = () => menu(!nv.classList.contains('open'));
  $$('#nv a').forEach(a => a.addEventListener('click', () => menu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && nv.classList.contains('open')) { menu(false); bg.focus(); } });
  addEventListener('resize', () => { if (innerWidth > 1080 && nv.classList.contains('open')) menu(false); });
}

/* revelação durante a rolagem; sem suporte, tudo aparece */
function reveal(root = document) {
  const els = $$('.rv:not(.in)', root);
  if (reduce || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => io.observe(e));
  setTimeout(() => els.forEach(e => { const r = e.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) e.classList.add('in'); }), 400);
}

window.Guarita = { CONFIG, $, $$, reduce, wa, esc, src, imovelUrl, fmt, card, data, chrome, reveal };
})();
