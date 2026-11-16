/* /api/equipe: cria o login de um corretor/gestor ou redefine a senha, direto pelo painel.
   Usa a chave secreta do Supabase (variável SUPABASE_SERVICE_ROLE_KEY no Netlify, nunca no código
   nem no navegador) e só atende quem está logado como GESTOR ativo (conferido no banco). */
import gen from '../shared/config.gen.mjs';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const URL_ = () => (process.env.SUPABASE_URL || gen.supabaseUrl || '').replace(/\/$/, '');
const ANON = () => process.env.SUPABASE_ANON_KEY || gen.supabaseAnonKey;
const SECRETA = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
/* chave antiga (JWT, eyJ…) vai também como Bearer; a nova (sb_secret_…) só no apikey */
const comChave = k => ({ apikey: k, ...(/^eyJ/.test(k) ? { Authorization: `Bearer ${k}` } : {}) });

async function rpcComoGestor(token, fn, body) {
  const r = await fetch(`${URL_()}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON(), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch (_) { d = t; }
  return { ok: r.ok, status: r.status, data: d };
}
const msgErro = d => (d && (d.message || d.msg || d.error_description || d.error)) || 'erro desconhecido';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { erro: 'Use POST.' });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || !URL_()) return json(401, { erro: 'Entre no painel para continuar.' });
  const g = await rpcComoGestor(token, 'is_gestor');
  if (!g.ok || g.data !== true) return json(403, { erro: 'Só gestores podem criar acessos ou trocar senhas.' });
  if (!SECRETA()) return json(503, { erro: 'Falta configurar a chave secreta do Supabase no Netlify (variável SUPABASE_SERVICE_ROLE_KEY). Veja o passo a passo no README, seção "Criar acessos pelo painel".' });

  let b; try { b = await req.json(); } catch (_) { return json(400, { erro: 'Pedido inválido.' }); }
  const senha = String(b.senha || '');
  if (senha && senha.length < 8) return json(400, { erro: 'A senha precisa ter pelo menos 8 caracteres.' });

  if (b.acao === 'criar') {
    const email = String(b.email || '').trim().toLowerCase(), nome = String(b.nome || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { erro: 'Informe um e-mail válido.' });
    if (nome.length < 2) return json(400, { erro: 'Informe o nome.' });
    if (!senha) return json(400, { erro: 'Informe a senha provisória (ou toque em "Gerar senha").' });
    // 1) cria o login já confirmado (se o e-mail já tiver login, só o coloca na equipe)
    const r = await fetch(`${URL_()}/auth/v1/admin/users`, { method: 'POST', headers: { ...comChave(SECRETA()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha, email_confirm: true, user_metadata: { nome } }) });
    let jaExistia = false;
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      if (r.status === 422 && /already|exists|registered/i.test(msgErro(d) + (d.error_code || d.code || ''))) jaExistia = true;
      else if (r.status === 401 || r.status === 403) return json(502, { erro: 'A chave secreta configurada no Netlify não foi aceita pelo Supabase. Confira se copiou a chave "service_role" (ou "secret") inteira.' });
      else return json(400, { erro: 'O Supabase recusou a criação do login: ' + msgErro(d) });
    }
    // 2) coloca na equipe (mesma regra do banco usada pela aba Equipe, com o login do gestor)
    const e = await rpcComoGestor(token, 'equipe_salvar', { p_email: email, p_nome: nome, p_papel: b.papel === 'gestor' ? 'gestor' : 'corretor',
      p_telefone: b.telefone || null, p_ativo: true, p_recebe_rodizio: b.recebe_rodizio !== false });
    if (!e.ok) return json(400, { erro: 'Login criado, mas não entrou na equipe: ' + msgErro(e.data) });
    return json(200, { ok: true, jaExistia });
  }

  if (b.acao === 'senha') {
    const id = String(b.user_id || '');
    if (!/^[0-9a-f-]{36}$/.test(id) || !senha) return json(400, { erro: 'Informe a nova senha.' });
    // só troca senha de quem é da equipe
    const m = await fetch(`${URL_()}/rest/v1/admins?select=user_id&user_id=eq.${id}`, { headers: { apikey: ANON(), Authorization: `Bearer ${token}` } });
    if (!m.ok || !(await m.json()).length) return json(404, { erro: 'Essa pessoa não está na equipe.' });
    const r = await fetch(`${URL_()}/auth/v1/admin/users/${id}`, { method: 'PUT', headers: { ...comChave(SECRETA()), 'Content-Type': 'application/json' }, body: JSON.stringify({ password: senha }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); return json(r.status === 401 || r.status === 403 ? 502 : 400, { erro: 'O Supabase recusou a troca de senha: ' + msgErro(d) }); }
    return json(200, { ok: true });
  }
  return json(400, { erro: 'Ação desconhecida.' });
};
export const config = { path: '/api/equipe' };
