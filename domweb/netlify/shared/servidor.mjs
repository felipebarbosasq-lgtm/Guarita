// DOM Web: utilidades das funções do servidor (Netlify Functions).
// Variáveis de ambiente (Netlify > Site configuration > Environment variables):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN   (API oficial do WhatsApp, opcional)
//   WHATSAPP_TEMPLATE_STATUS                                     (modelo aprovado para avisos, opcional)
//   ANTHROPIC_API_KEY, CLAUDE_MODEL                              (IA do atendente, opcional)

const env = (k) => process.env[k] || '';

export function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Chamada ao banco com a chave de serviço (ignora RLS: use só no servidor).
export async function banco(caminho, { metodo = 'GET', corpo, headers = {} } = {}) {
  const url = env('SUPABASE_URL');
  const chave = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !chave) throw new Error('Supabase não configurado no servidor');
  const r = await fetch(`${url}${caminho}`, {
    method: metodo,
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json', ...headers },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!r.ok) throw new Error(dados?.message || `Erro do banco ${r.status}`);
  return dados;
}

export async function carregarDados() {
  const [linha] = await banco('/rest/v1/cardapio?id=eq.1&select=dados');
  if (!linha) throw new Error('Cardápio não cadastrado');
  const cupons = await banco('/rest/v1/cupons?select=*&ativo=eq.true');
  return { ...linha.dados, cupons: cupons.map((c) => ({ ...c, valor: Number(c.valor), minimo: Number(c.minimo) })) };
}

// Confere se quem chamou está logado no painel (token do Supabase Auth).
export async function usuarioDoToken(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` },
  });
  return r.ok ? r.json() : null;
}

export const whatsappConfigurado = () => !!(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_ID'));

export function numeroWhats(tel) {
  let n = String(tel || '').replace(/\D/g, '');
  if (n.length <= 11) n = '55' + n;
  return n;
}

// Envia mensagem pela API oficial do WhatsApp (Meta Cloud API).
export async function enviarWhats(para, corpo) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${env('WHATSAPP_PHONE_ID')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: numeroWhats(para), ...corpo }),
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados?.error?.message || `WhatsApp respondeu ${r.status}`);
  return dados;
}

export const enviarTexto = (para, texto) => enviarWhats(para, { type: 'text', text: { body: texto.slice(0, 4000), preview_url: true } });

export { env };
