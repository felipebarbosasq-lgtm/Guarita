/* Guarita Imobiliária: página individual do imóvel, gerada a partir do cadastro (sem editar HTML). */
(function () {
'use strict';
const G = window.Guarita, { $, $$, esc, src, fmt, wa, CONFIG } = G;
G.chrome();

/* /imovel/<slug> (Netlify) ou imovel/index.html?i=<slug> (visualização local) */
function slug() {
  const q = new URLSearchParams(location.search).get('i');
  if (q) return q;
  const m = location.pathname.match(/\/imovel\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}
const setMeta = (sel, attr, val) => { let el = document.head.querySelector(sel); if (!el) { el = document.createElement('meta'); const [k, v] = sel.match(/\[(\w+)="([^"]+)"\]/).slice(1); el.setAttribute(k, v); document.head.appendChild(el); } el.setAttribute(attr, val); };
const n = v => v === null || v === undefined || v === '' ? null : Number(v);
const text = s => esc(s).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

function waMsg(im) {
  return `Olá, Guarita Imobiliária! Gostaria de receber mais informações sobre o imóvel ${fmt.title(im)}` + (im.codigo ? `, referência ${im.codigo}.` : '.');
}

function render(im) {
  const title = fmt.title(im), fotos = im.fotos || [];
  document.title = `${im.nome}${im.complemento ? ' ' + im.complemento : ''} | ${fmt.loc(im)} | Guarita Imobiliária`;
  const desc = `${[im.tipo, fmt.loc(im)].filter(Boolean).join(' em ')}. ${fmt.specs(im).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}. ${fmt.priceLabel(im)}: ${fmt.price(im)}.`;
  setMeta('meta[name="description"]', 'content', desc);
  setMeta('meta[property="og:title"]', 'content', `${im.nome} | Guarita Imobiliária`);
  setMeta('meta[property="og:description"]', 'content', desc);
  if (fotos[0]) setMeta('meta[property="og:image"]', 'content', new URL(src(fotos[0].lg), location.href).href);
  if (CONFIG.siteUrl) { const l = document.createElement('link'); l.rel = 'canonical'; l.href = CONFIG.siteUrl.replace(/\/$/, '') + '/imovel/' + encodeURIComponent(im.slug); document.head.appendChild(l); }
  const ld = document.createElement('script'); ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'RealEstateListing', name: title, description: im.descricao || desc,
    image: fotos.slice(0, 6).map(f => new URL(src(f.lg), location.href).href), url: location.href,
    offers: n(im.valor) ? { '@type': 'Offer', price: n(im.valor), priceCurrency: 'BRL', businessFunction: im.finalidade === 'locacao' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell' } : undefined,
    address: { '@type': 'PostalAddress', streetAddress: im.endereco, addressLocality: im.cidade, addressRegion: im.estado, addressCountry: 'BR' } });
  document.head.appendChild(ld);

  $('#im-crumb').textContent = im.nome;
  $('#im-loc').textContent = fmt.loc(im);
  $('#im-nome').textContent = im.nome;
  $('#im-unit').textContent = fmt.unit(im);
  $('#im-preco').textContent = fmt.price(im);
  $('#im-plabel').textContent = fmt.priceLabel(im);
  $('#im-ref').textContent = im.codigo ? `Referência ${im.codigo}` : '';
  const st = fmt.status(im); if (st) { $('#im-status').textContent = st; $('#im-status').hidden = false; }
  const link = wa(waMsg(im));
  $('#im-wa').href = link; $('#lb-wa').href = link;

  /* informações técnicas: só aparecem as que foram preenchidas */
  const rows = [
    ['Tipo', im.tipo], ['Finalidade', im.finalidade === 'locacao' ? 'Locação' : 'Venda'],
    ['Dormitórios', n(im.dormitorios)], ['Suítes', n(im.suites)], ['Banheiros', n(im.banheiros)], ['Vagas', n(im.vagas)],
    ['Área privativa', n(im.area_privativa) ? fmt.area(n(im.area_privativa)) : null], ['Área total', n(im.area_total) ? fmt.area(n(im.area_total)) : null],
    ['Referência', im.codigo]
  ].filter(r => r[1] !== null && r[1] !== undefined && r[1] !== '');
  $('#im-specs').innerHTML = rows.map(([k, v]) => `<li><span>${k}</span><b>${esc(v)}</b></li>`).join('');

  if (im.descricao) { $('#im-desc').innerHTML = text(im.descricao); $('#im-desc-sec').hidden = false; }
  const feats = (im.caracteristicas || []).filter(Boolean);
  if (feats.length) { $('#im-car').innerHTML = feats.map(f => `<li>${esc(f)}</li>`).join(''); $('#im-car-sec').hidden = false; }
  if (im.info_complementar) { $('#im-info').innerHTML = text(im.info_complementar); $('#im-info-sec').hidden = false; }
  const end = [im.endereco, im.bairro, [im.cidade, im.estado].filter(Boolean).join(' – ')].filter(Boolean).join(', ');
  $('#im-end').textContent = end;
  $('#im-map').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(end);

  /* galeria: foto principal grande + miniaturas; tudo abre a visualização em tela cheia */
  const gal = $('#gal');
  if (!fotos.length) gal.hidden = true;
  else {
    const alt = (f, k) => f.alt || `${title}: foto ${k + 1} de ${fotos.length}`;
    const side = fotos.slice(1, 5);
    gal.className = 'gal n' + Math.min(fotos.length, 5);
    gal.innerHTML = `<button type="button" class="g0" data-i="0" aria-label="Abrir galeria: foto 1 de ${fotos.length}"><img src="${esc(src(fotos[0].lg))}" srcset="${esc(src(fotos[0].md || fotos[0].lg))} 720w, ${esc(src(fotos[0].lg))} 1280w" sizes="(max-width:860px) 100vw, 760px" alt="${esc(alt(fotos[0], 0))}" width="${fotos[0].w || 1280}" height="${fotos[0].h || 853}" fetchpriority="high"></button>`
      + side.map((f, k) => `<button type="button" data-i="${k + 1}" aria-label="Abrir galeria: foto ${k + 2} de ${fotos.length}"><img src="${esc(src(f.md || f.lg))}" alt="${esc(alt(f, k + 1))}" width="${f.w || 1280}" height="${f.h || 853}" loading="lazy" decoding="async"></button>`).join('')
      + (fotos.length > 1 ? `<button type="button" class="g-all" data-i="0">Ver as ${fotos.length} fotos</button>` : '');
    gal.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) openLB(+b.dataset.i); });
  }
  gallery(im, fotos, title);
  $('#im-loading').hidden = true; $('#im').hidden = false;
}

/* visualização em tela cheia (teclado, setas e gesto de deslizar) */
let openLB = () => {};
function gallery(im, fotos, title) {
  const lb = $('#lb'), li = $('#li'), tb = $('#tb'); let gi = 0, last;
  const G2 = fotos.map(f => ({ big: src(f.lg), th: src(f.th || f.md) }));
  $('#lb-t').textContent = title; $('#lb-p').textContent = fmt.price(im);
  function view(k) {
    gi = (k + G2.length) % G2.length; li.src = G2[gi].big; li.alt = `${title}, foto ${gi + 1} de ${G2.length}`; $('#ln').textContent = `${gi + 1} / ${G2.length}`;
    [...tb.children].forEach((b, j) => b.classList.toggle('on', j === gi)); tb.children[gi].scrollIntoView({ inline: 'center', block: 'nearest' });
    [1, -1].forEach(d => { const p = G2[(gi + d + G2.length) % G2.length]; if (p) new Image().src = p.big; });
  }
  openLB = k => {
    if (!G2.length) return;
    last = document.activeElement;
    if (!tb.children.length) tb.innerHTML = G2.map((g, j) => `<button type="button" data-i="${j}" aria-label="Foto ${j + 1}"><img src="${esc(g.th)}" alt="" width="200" height="133" loading="lazy"></button>`).join('');
    lb.hidden = false; lb.classList.add('on'); document.body.style.overflow = 'hidden'; view(k); $('#lx').focus();
  };
  function close() { lb.classList.remove('on'); lb.hidden = true; document.body.style.overflow = ''; last && last.focus(); }
  $('#lx').onclick = close; $('#lp').onclick = () => view(gi - 1); $('#lnx').onclick = () => view(gi + 1);
  tb.onclick = e => { const b = e.target.closest('button'); if (b) view(+b.dataset.i); };
  lb.addEventListener('click', e => { if (e.target.classList.contains('stage')) close(); });
  addEventListener('keydown', e => {
    if (lb.hidden) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') view(gi - 1); if (e.key === 'ArrowRight') view(gi + 1);
    if (e.key === 'Tab') { const f = $$('a[href],button', lb).filter(x => x.offsetParent); const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  });
  let tx = 0; lb.addEventListener('touchstart', e => tx = e.touches[0].clientX, { passive: true });
  lb.addEventListener('touchend', e => { const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 50) view(gi + (d < 0 ? 1 : -1)); });
}

function notFound() {
  document.title = 'Imóvel não encontrado | Guarita Imobiliária';
  setMeta('meta[name="robots"]', 'content', 'noindex');
  $('#im-crumb').textContent = 'Não encontrado';
  $('#im-loading').hidden = true; $('#im-404').hidden = false;
}

(async () => {
  const s = slug();
  if (!s) return notFound();
  try { const im = await G.data.get(s); im ? render(im) : notFound(); }
  catch (e) { console.warn(e); $('#im-loading').textContent = 'Não foi possível carregar o imóvel agora. Tente novamente em instantes ou fale com a Guarita pelo WhatsApp.'; }
  G.reveal();
})();
})();
