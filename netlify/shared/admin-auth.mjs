/* Confere se o pedido vem de alguém logado no painel (tabela admins no Supabase, protegida por RLS). */
import gen from './config.gen.mjs';
export async function isAdmin(req) {
  const url = (process.env.SUPABASE_URL || gen.supabaseUrl || '').replace(/\/$/, ''), key = process.env.SUPABASE_ANON_KEY || gen.supabaseAnonKey;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!url || !key || !token) return false;
  try {
    // mesma regra do banco: public.is_admin() (membro da equipe com acesso ativo)
    const r = await fetch(`${url}/rest/v1/rpc/is_admin`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
    return r.ok && (await r.json()) === true;
  } catch (_) { return false; }
}
