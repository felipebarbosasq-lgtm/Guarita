/* Coloca no HTML de /imovel/<nome> o título, a descrição e a foto do imóvel antes de enviar a página.
   Assim o Google e as prévias de links (WhatsApp, Instagram, Facebook) mostram o imóvel certo.
   Se o banco não responder, a página segue normalmente e é preenchida no navegador. */
import { injectMeta, fetchImoveis } from '../shared/meta.mjs';
import gen from '../shared/config.gen.mjs';

export default async (request, context) => {
  const res = await context.next();
  const url = Netlify.env.get('SUPABASE_URL') || gen.supabaseUrl, key = Netlify.env.get('SUPABASE_ANON_KEY') || gen.supabaseAnonKey;
  const slug = decodeURIComponent(new URL(request.url).pathname.split('/')[2] || '');
  if (!url || !key || !slug || slug === 'index.html' || !(res.headers.get('content-type') || '').includes('text/html')) return res;
  try {
    const [im] = await fetchImoveis(url, key, `select=slug,nome,complemento,tipo,bairro,cidade,valor,finalidade,dormitorios,suites,vagas,area_privativa,fotos&publicado=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    if (!im) return new Response(await res.text(), { status: 404, headers: res.headers });
    const origin = (Netlify.env.get('SITE_URL') || gen.siteUrl || new URL(request.url).origin).replace(/\/$/, '');
    const headers = new Headers(res.headers); headers.delete('content-length');
    return new Response(injectMeta(await res.text(), im, origin), { status: 200, headers });
  } catch (e) {
    console.error(e);
    return res;
  }
};
export const config = { path: '/imovel/*' };
