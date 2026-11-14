/* /api/dwv-foto?u=<endereço da foto no DWV>
   Caminho alternativo da importação: quando o navegador (por exemplo, Safari/iPad) não consegue baixar
   a foto direto do DWV, o painel pede por aqui e a foto chega pelo próprio site. Só para administradores. */
import { isAdmin } from '../shared/admin-auth.mjs';

const PERMITIDOS = /^https:\/\/dwvimages\.(s3(\.[a-z0-9-]+)?\.amazonaws\.com|[a-z0-9-]+\.digitaloceanspaces\.com)\//;
const MAX = 5.5 * 1024 * 1024; // limite de resposta das funções do Netlify

export default async (req) => {
  const u = new URL(req.url).searchParams.get('u') || '';
  if (!PERMITIDOS.test(u)) return new Response('Endereço de foto não permitido.', { status: 400 });
  if (!(await isAdmin(req))) return new Response('Entre no painel como administrador.', { status: 401 });
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return new Response(`O DWV respondeu ${r.status}.`, { status: 502 });
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX) return new Response('Foto grande demais para o caminho alternativo.', { status: 413 });
    const tipo = /\.png(\?|$)/i.test(u) ? 'image/png' : /\.webp(\?|$)/i.test(u) ? 'image/webp' : 'image/jpeg';
    return new Response(buf, { headers: { 'Content-Type': tipo, 'Cache-Control': 'private, max-age=600' } });
  } catch (_) { return new Response('O DWV não respondeu a tempo.', { status: 504 }); }
};
export const config = { path: '/api/dwv-foto' };
