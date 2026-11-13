/* /sitemap.xml gerado na hora com todos os imóveis publicados (atualiza sozinho a cada cadastro). */
import { sitemap, fetchImoveis } from '../shared/meta.mjs';
import gen from '../shared/config.gen.mjs';

export default async (req) => {
  const url = process.env.SUPABASE_URL || gen.supabaseUrl, key = process.env.SUPABASE_ANON_KEY || gen.supabaseAnonKey;
  const origin = (process.env.SITE_URL || gen.siteUrl || new URL(req.url).origin).replace(/\/$/, '');
  let list = [];
  if (url && key) {
    try { list = await fetchImoveis(url, key, 'select=slug,updated_at&publicado=eq.true&order=ordem'); }
    catch (e) { console.error(e); }
  } else {
    list = [{ slug: 'eleganza-tower-apartamento-4200' }]; // modo demonstração
  }
  return new Response(sitemap(origin, list), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
};
export const config = { path: '/sitemap.xml' };
