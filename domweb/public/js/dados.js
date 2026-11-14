// DOM Web: camada de dados.
// - Modo DEMONSTRAÇÃO (sem Supabase configurado): tudo fica no navegador (localStorage).
//   Abra o cardápio numa aba e o painel em outra: os pedidos aparecem na hora.
// - Modo PRODUÇÃO (Supabase configurado em config.js): cardápio e pedidos ficam no banco,
//   e o pedido é criado pela função do servidor, que recalcula os preços.

import { calcularPedido, novoId } from './nucleo.js';

const CFG = window.DOMWEB_CONFIG || {};
export const modoDemo = !(CFG.supabaseUrl && CFG.supabaseAnonKey);

const K_DADOS = 'domweb:dados';
const K_PEDIDOS = 'domweb:pedidos';
const K_SESSAO = 'domweb:sessao';

const lerLS = (k, padrao) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : padrao;
  } catch {
    return padrao;
  }
};
const gravarLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));

async function semente() {
  const r = await fetch('/data/loja-inicial.json', { cache: 'no-cache' });
  return r.json();
}

// ---------- Supabase (REST) ----------

function sessao() {
  return lerLS(K_SESSAO, null);
}

async function sb(caminho, { metodo = 'GET', corpo, auth = false, headers = {} } = {}) {
  let token = CFG.supabaseAnonKey;
  if (auth) {
    const s = await sessaoValida();
    if (!s) throw new Error('Sessão expirada. Entre novamente.');
    token = s.access_token;
  }
  const r = await fetch(`${CFG.supabaseUrl}${caminho}`, {
    method: metodo,
    headers: {
      apikey: CFG.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: corpo === undefined ? undefined : typeof corpo === 'string' || corpo instanceof Blob ? corpo : JSON.stringify(corpo),
  });
  const texto = await r.text();
  const json = texto ? JSON.parse(texto) : null;
  if (!r.ok) throw new Error(json?.message || json?.error_description || json?.msg || `Erro ${r.status}`);
  return json;
}

async function sessaoValida() {
  const s = sessao();
  if (!s) return null;
  if (s.expires_at * 1000 > Date.now() + 60_000) return s;
  try {
    const nova = await fetch(`${CFG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: CFG.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    }).then((r) => (r.ok ? r.json() : null));
    if (!nova) throw new Error();
    gravarLS(K_SESSAO, nova);
    return nova;
  } catch {
    localStorage.removeItem(K_SESSAO);
    return null;
  }
}

// ---------- API pública usada pelas telas ----------

export async function carregarCardapio() {
  if (modoDemo) {
    let d = lerLS(K_DADOS, null);
    if (!d) {
      d = await semente();
      gravarLS(K_DADOS, d);
    }
    return d;
  }
  const linhas = await sb('/rest/v1/cardapio?id=eq.1&select=dados');
  if (!linhas?.[0]) throw new Error('Cardápio ainda não foi cadastrado no banco.');
  return { cupons: [], ...linhas[0].dados };
}

export async function criarPedido(entrada) {
  if (modoDemo) {
    const dados = await carregarCardapio();
    const { erros, pedido } = calcularPedido(dados, entrada);
    if (erros.length) throw new Error(erros.join('\n'));
    const pedidos = lerLS(K_PEDIDOS, []);
    const numero = (pedidos.reduce((m, p) => Math.max(m, p.numero), 1000) || 1000) + 1;
    const novo = { ...pedido, id: crypto.randomUUID(), numero, status: 'novo', criado_em: new Date().toISOString(), historico: [{ status: 'novo', em: new Date().toISOString() }] };
    pedidos.push(novo);
    gravarLS(K_PEDIDOS, pedidos);
    return novo;
  }
  const r = await fetch('/.netlify/functions/pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.erro || 'Não foi possível enviar o pedido');
  return json.pedido;
}

export async function consultarPedido(id) {
  if (modoDemo) return lerLS(K_PEDIDOS, []).find((p) => p.id === id) || null;
  const r = await fetch(`/.netlify/functions/pedidos?id=${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  return (await r.json()).pedido;
}

export async function validarCupom(codigo, subtotal) {
  if (modoDemo) {
    const d = await carregarCardapio();
    return (d.cupons || []).find((c) => c.ativo && c.codigo.toUpperCase() === codigo.trim().toUpperCase()) || null;
  }
  const r = await fetch(`/.netlify/functions/pedidos?cupom=${encodeURIComponent(codigo)}&subtotal=${subtotal}`);
  if (!r.ok) return null;
  return (await r.json()).cupom;
}

// ---------- Painel (restaurante) ----------

export async function entrar(email, senha) {
  if (modoDemo) return { email: 'demo' };
  const r = await fetch(`${CFG.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CFG.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error('E-mail ou senha incorretos');
  gravarLS(K_SESSAO, json);
  return json.user;
}

export async function usuarioAtual() {
  if (modoDemo) return { email: 'demo' };
  const s = await sessaoValida();
  return s ? s.user : null;
}

export function sair() {
  localStorage.removeItem(K_SESSAO);
}

export async function carregarCardapioAdmin() {
  const d = await carregarCardapio();
  if (!modoDemo) d.cupons = await sb('/rest/v1/cupons?select=*&order=codigo', { auth: true });
  return d;
}

// Salva loja, bairros, categorias e produtos (e cupons).
export async function salvarCardapio(d) {
  const { cupons = [], ...publico } = d;
  if (modoDemo) {
    gravarLS(K_DADOS, { ...publico, cupons });
    return;
  }
  await sb('/rest/v1/cardapio?id=eq.1', { metodo: 'PATCH', auth: true, corpo: { dados: publico, atualizado_em: new Date().toISOString() } });
  await sb('/rest/v1/cupons?id=not.is.null', { metodo: 'DELETE', auth: true });
  if (cupons.length) await sb('/rest/v1/cupons', { metodo: 'POST', auth: true, corpo: cupons });
}

export async function listarPedidos(desdeISO) {
  if (modoDemo) return lerLS(K_PEDIDOS, []).filter((p) => !desdeISO || p.criado_em >= desdeISO).sort((a, b) => b.numero - a.numero);
  const filtro = desdeISO ? `&criado_em=gte.${encodeURIComponent(desdeISO)}` : '';
  return sb(`/rest/v1/pedidos?select=*&order=numero.desc&limit=2000${filtro}`, { auth: true });
}

export async function atualizarPedido(id, mudancas) {
  if (modoDemo) {
    const pedidos = lerLS(K_PEDIDOS, []);
    const p = pedidos.find((x) => x.id === id);
    if (!p) return null;
    if (mudancas.status && mudancas.status !== p.status) {
      p.historico = [...(p.historico || []), { status: mudancas.status, em: new Date().toISOString() }];
    }
    Object.assign(p, mudancas);
    gravarLS(K_PEDIDOS, pedidos);
    return p;
  }
  const atual = (await sb(`/rest/v1/pedidos?id=eq.${id}&select=historico,status`, { auth: true }))[0];
  if (mudancas.status && atual && mudancas.status !== atual.status) {
    mudancas = { ...mudancas, historico: [...(atual.historico || []), { status: mudancas.status, em: new Date().toISOString() }] };
  }
  const r = await sb(`/rest/v1/pedidos?id=eq.${id}`, { metodo: 'PATCH', auth: true, corpo: mudancas, headers: { Prefer: 'return=representation' } });
  return r[0];
}

// Pedido lançado pelo próprio restaurante (PDV / balcão / mesa / telefone).
export async function criarPedidoInterno(entrada) {
  const dados = await carregarCardapio();
  const { erros, pedido } = calcularPedido(dados, entrada, { origem: 'pdv' });
  const graves = erros.filter((e) => /vazio|indisponível|Escolha (ao menos|no máximo)/.test(e));
  if (graves.length) throw new Error(graves.join('\n'));
  if (modoDemo) {
    const pedidos = lerLS(K_PEDIDOS, []);
    const numero = pedidos.reduce((m, p) => Math.max(m, p.numero), 1000) + 1;
    const novo = { ...pedido, id: crypto.randomUUID(), numero, status: 'preparo', origem: 'pdv', criado_em: new Date().toISOString(), historico: [{ status: 'preparo', em: new Date().toISOString() }] };
    pedidos.push(novo);
    gravarLS(K_PEDIDOS, pedidos);
    return novo;
  }
  const r = await sb('/rest/v1/pedidos', {
    metodo: 'POST',
    auth: true,
    corpo: { ...pedido, status: 'preparo', origem: 'pdv', historico: [{ status: 'preparo', em: new Date().toISOString() }] },
    headers: { Prefer: 'return=representation' },
  });
  return r[0];
}

// Avisa quando chegam pedidos novos ou mudam (entre abas no modo demo; a cada 5 s no Supabase).
export function observarPedidos(callback) {
  if (modoDemo) {
    const fn = (e) => e.key === K_PEDIDOS && callback();
    window.addEventListener('storage', fn);
    const t = setInterval(callback, 5000);
    return () => {
      window.removeEventListener('storage', fn);
      clearInterval(t);
    };
  }
  const t = setInterval(callback, 5000);
  return () => clearInterval(t);
}

// Envia uma foto: no Supabase vai para o Storage; no modo demo vira uma imagem reduzida embutida.
export async function enviarImagem(arquivo) {
  const blob = await reduzirImagem(arquivo, 900);
  if (modoDemo) {
    return await new Promise((ok) => {
      const fr = new FileReader();
      fr.onload = () => ok(fr.result);
      fr.readAsDataURL(blob);
    });
  }
  const nome = `${novoId('img')}.jpg`;
  await sb(`/storage/v1/object/imagens/${nome}`, { metodo: 'POST', auth: true, corpo: blob, headers: { 'Content-Type': 'image/jpeg' } });
  return `${CFG.supabaseUrl}/storage/v1/object/public/imagens/${nome}`;
}

async function reduzirImagem(arquivo, limite) {
  const url = URL.createObjectURL(arquivo);
  const img = await new Promise((ok, erro) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = erro;
    i.src = url;
  });
  const esc = Math.min(1, limite / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * esc);
  c.height = Math.round(img.height * esc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8));
}

// Notificação automática via WhatsApp oficial (só quando a API estiver configurada no servidor).
export async function notificarClienteAutomatico(pedido) {
  if (modoDemo || !CFG.whatsappApi) return false;
  const s = await sessaoValida();
  const r = await fetch('/.netlify/functions/notificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token}` },
    body: JSON.stringify({ id: pedido.id }),
  });
  return r.ok;
}

export function resetarDemo() {
  localStorage.removeItem(K_DADOS);
  localStorage.removeItem(K_PEDIDOS);
}
