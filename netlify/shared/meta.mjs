/* Funções puras usadas pelas funções do Netlify (testadas em tools/test-netlify.mjs). */
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const abs = (p, origin) => !p ? '' : /^https?:/.test(p) ? p : origin + '/' + String(p).replace(/^\//, '');

export function describe(im) {
  const parts = [];
  if (im.dormitorios) parts.push(`${im.dormitorios} ${im.dormitorios == 1 ? 'dormitório' : 'dormitórios'}${im.suites ? `, ${im.suites} ${im.suites == 1 ? 'suíte' : 'suítes'}` : ''}`);
  if (im.vagas) parts.push(`${im.vagas} ${im.vagas == 1 ? 'vaga' : 'vagas'}`);
  if (im.area_privativa) parts.push(`${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(im.area_privativa))} m² privativos`);
  const where = [im.bairro, im.cidade].filter(Boolean).join(', ');
  const price = Number(im.valor) ? `R$ ${nf.format(Number(im.valor))}${im.finalidade === 'locacao' ? '/mês' : ''}` : '';
  return [`${im.tipo || 'Imóvel'} em ${where}`, parts.join(' · '), price].filter(Boolean).join('. ') + '.';
}

/* Insere título, descrição, imagem e link canônico do imóvel no HTML (para Google e prévias do WhatsApp). */
export function injectMeta(html, im, origin) {
  const title = `${im.nome}${im.complemento ? ' ' + im.complemento : ''} | ${[im.bairro, im.cidade].filter(Boolean).join(' · ')} | Guarita Imobiliária`;
  const desc = describe(im);
  const img = im.fotos && im.fotos[0] ? abs(im.fotos[0].lg, origin) : abs('assets/img/site/og.jpg', origin);
  const url = `${origin}/imovel/${encodeURIComponent(im.slug)}`;
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(im.nome)} | Guarita Imobiliária$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(img)}$2`)
    .replace('</head>', `<link rel="canonical" href="${esc(url)}">\n<meta property="og:url" content="${esc(url)}">\n</head>`);
}

export function sitemap(origin, imoveis) {
  const u = (loc, lastmod, pr) => `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${String(lastmod).slice(0, 10)}</lastmod>` : ''}<priority>${pr}</priority></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [u(origin + '/', null, '1.0'), ...imoveis.map(i => u(`${origin}/imovel/${encodeURIComponent(i.slug)}`, i.updated_at, '0.8'))].join('\n') +
    `\n</urlset>\n`;
}

export async function fetchImoveis(supabaseUrl, key, query) {
  const r = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/imoveis?${query}`, { headers: { apikey: key, ...(/^eyJ/.test(key) ? { Authorization: `Bearer ${key}` } : {}) } });
  if (!r.ok) throw new Error('Supabase ' + r.status);
  return r.json();
}
