/* /api/dwv?link=<link ou mensagem de compartilhamento do DWV>
   Usada pelo painel /admin ("Importar do DWV"). Só responde a administradores logados:
   o token de login é conferido no Supabase (tabela admins, protegida por RLS). */
import { findLink, extractNextData, normalize } from '../shared/dwv.mjs';
import gen from '../shared/config.gen.mjs';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

async function isAdmin(req) {
  const url = (process.env.SUPABASE_URL || gen.supabaseUrl || '').replace(/\/$/, ''), key = process.env.SUPABASE_ANON_KEY || gen.supabaseAnonKey;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!url || !key || !token) return false;
  try {
    const r = await fetch(`${url}/rest/v1/admins?select=user_id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    return r.ok && (await r.json()).length === 1;
  } catch (_) { return false; }
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { erro: 'Use POST.' });
  if (!(await isAdmin(req))) return json(401, { erro: 'Entre no painel como administrador para importar.' });
  let texto = '';
  try { texto = String((await req.json()).texto || '').slice(0, 20000); } catch (_) { return json(400, { erro: 'Pedido inválido.' }); }
  const link = findLink(texto);
  if (!link) return json(400, { erro: 'Não encontrei um link de compartilhamento do DWV (lp.dwvapp.com.br/...). Cole o link ou a mensagem inteira.' });
  let html;
  try {
    const r = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GuaritaImport/1.0)', Accept: 'text/html' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return json(502, { erro: `O DWV respondeu com erro ${r.status}. Confira se o link abre no navegador.` });
    html = await r.text();
  } catch (_) { return json(504, { erro: 'O DWV não respondeu a tempo. Tente de novo em instantes.' }); }
  try {
    return json(200, { link, ...normalize(extractNextData(html), texto) });
  } catch (e) {
    return json(422, { erro: `Não consegui ler esta página do DWV: ${e.message}. Cadastre manualmente ou me avise para ajustar a importação.` });
  }
};
export const config = { path: '/api/dwv' };
