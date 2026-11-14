// DOM Web: painel do restaurante.
import * as db from './dados.js';
import {
  STATUS, TIPOS, DIAS_SEMANA, reais, arred, precoProduto, situacaoLoja, montarItem, calcularPedido,
  mensagemStatusCliente, linkWhatsApp, textoEndereco, novoId,
} from './nucleo.js';
import { $, $$, esc, toast, formatarTelefone, dataHora, hora, minutosDesde } from './ui.js';

const CFG = window.DOMWEB_CONFIG || {};
let D = null; // cardápio + configurações
let pedidos = [];
let rota = 'pedidos';
let somLigado = localStorage.getItem('domweb:som') !== '0';
const vistos = new Set(JSON.parse(localStorage.getItem('domweb:vistos') || '[]'));

const TITULOS = {
  pedidos: 'Pedidos', pdv: 'PDV / Balcão', cardapio: 'Cardápio', entrega: 'Entrega', cupons: 'Cupons',
  clientes: 'Clientes', relatorios: 'Relatórios', whatsapp: 'WhatsApp e IA', loja: 'Minha loja',
};

// ---------- Inicialização e login ----------

(async function init() {
  const user = await db.usuarioAtual();
  if (!user) return mostrarLogin();
  await iniciarApp();
})();

function mostrarLogin() {
  $('#telaLogin').classList.remove('oculto');
  $('#formLogin').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await db.entrar($('#lEmail').value, $('#lSenha').value);
      $('#telaLogin').classList.add('oculto');
      await iniciarApp();
    } catch (err) {
      toast(err.message, true);
    }
  };
}

async function iniciarApp() {
  D = await db.carregarCardapioAdmin();
  $('#app').classList.remove('oculto');
  $('#avisoDemo').classList.toggle('oculto', !db.modoDemo);
  $('#btnResetDemo').onclick = async () => {
    if (!confirm('Apagar pedidos e alterações deste navegador e voltar ao cardápio original?')) return;
    db.resetarDemo();
    location.reload();
  };
  $('#btnSair').onclick = () => { db.sair(); location.reload(); };
  $('#abrirMenu').onclick = () => $('#lateral').classList.add('aberta');
  $('#fecharMenu').onclick = () => $('#lateral').classList.remove('aberta');
  $('#statusLoja').onchange = async (e) => {
    D.loja.status_manual = e.target.value;
    await salvar('Situação da loja atualizada');
    pintarLojaMini();
  };
  $('#btnSom').onclick = () => {
    somLigado = !somLigado;
    localStorage.setItem('domweb:som', somLigado ? '1' : '0');
    pintarSom();
    if (somLigado) bip();
  };
  $('#modalFundo').addEventListener('mousedown', (e) => e.target.id === 'modalFundo' && fecharModal());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && fecharModal());
  pintarSom();
  pintarLojaMini();
  window.addEventListener('hashchange', navegar);
  await atualizarPedidos(true);
  db.observarPedidos(() => atualizarPedidos());
  setInterval(pintarLojaMini, 60_000);
  if ('Notification' in window && Notification.permission === 'default') {
    document.body.addEventListener('click', () => Notification.requestPermission(), { once: true });
  }
  navegar();
}

function pintarSom() {
  $('#btnSom').textContent = somLigado ? '🔔 Som ligado' : '🔕 Som desligado';
}

function pintarLojaMini() {
  $('#miniLogo').src = D.loja.logo || '/img/logo.jpg';
  $('#miniNome').textContent = D.loja.nome;
  const s = situacaoLoja(D.loja);
  $('#miniStatus').textContent = s.motivo;
  $('#miniStatus').style.color = s.aberta ? '#7ee2a8' : '#ff9b9e';
  $('#statusLoja').value = D.loja.status_manual || 'auto';
}

async function salvar(msg = 'Alterações salvas') {
  try {
    await db.salvarCardapio(D);
    toast(msg);
  } catch (e) {
    toast(e.message, true);
  }
}

function navegar() {
  rota = (location.hash || '#pedidos').slice(1);
  if (!TITULOS[rota]) rota = 'pedidos';
  $('#titulo').textContent = TITULOS[rota];
  $$('#menu a').forEach((a) => a.classList.toggle('ativo', a.dataset.r === rota));
  $('#lateral').classList.remove('aberta');
  ({ pedidos: telaPedidos, pdv: telaPDV, cardapio: telaCardapio, entrega: telaEntrega, cupons: telaCupons,
    clientes: telaClientes, relatorios: telaRelatorios, whatsapp: telaWhatsApp, loja: telaLoja })[rota]();
}

// ---------- Modal ----------

function abrirModal(titulo, corpo, pe = '', largo = false) {
  const m = $('#modal');
  m.className = `modal ${largo ? 'largo' : ''}`;
  m.innerHTML = `<div class="modal-cab"><h2>${titulo}</h2><button class="fechar" type="button" aria-label="Fechar">×</button></div>
    <div class="modal-corpo">${corpo}</div>${pe ? `<div class="modal-pe">${pe}</div>` : ''}`;
  $('.fechar', m).onclick = fecharModal;
  $('#modalFundo').classList.remove('oculto');
  return m;
}
function fecharModal() {
  $('#modalFundo').classList.add('oculto');
}

// ---------- Alertas de novo pedido ----------

let ctxAudio;
function bip() {
  try {
    ctxAudio = ctxAudio || new (window.AudioContext || window.webkitAudioContext)();
    const t = ctxAudio.currentTime;
    [0, 0.18, 0.36].forEach((d, i) => {
      const o = ctxAudio.createOscillator();
      const g = ctxAudio.createGain();
      o.type = 'square';
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16);
      o.connect(g).connect(ctxAudio.destination);
      o.start(t + d);
      o.stop(t + d + 0.17);
    });
  } catch {}
}

let tAlerta;
function alertarNovos() {
  const novos = pedidos.filter((p) => p.status === 'novo');
  $('#contNovos').textContent = novos.length;
  $('#contNovos').classList.toggle('oculto', !novos.length);
  document.title = novos.length ? `(${novos.length}) Novo pedido! · DOM Web` : 'Painel · DOM Web';
  clearInterval(tAlerta);
  if (novos.length && somLigado) {
    bip();
    tAlerta = setInterval(() => somLigado && pedidos.some((p) => p.status === 'novo') && bip(), 6000);
  }
}

async function atualizarPedidos(primeira = false) {
  const desde = new Date(Date.now() - 90 * 86400000).toISOString();
  try {
    pedidos = await db.listarPedidos(desde);
  } catch (e) {
    return toast(e.message, true);
  }
  const chegaram = pedidos.filter((p) => p.status === 'novo' && !vistos.has(p.id));
  chegaram.forEach((p) => vistos.add(p.id));
  localStorage.setItem('domweb:vistos', JSON.stringify([...vistos].slice(-500)));
  if (!primeira && chegaram.length && 'Notification' in window && Notification.permission === 'granted') {
    chegaram.forEach((p) => new Notification(`Novo pedido #${p.numero}`, { body: `${p.cliente.nome} · ${reais(p.total)}`, icon: D.loja.logo }));
  }
  alertarNovos();
  if (rota === 'pedidos') telaPedidos();
}

// ---------- Tela: Pedidos (gestor) ----------

const PROXIMO = {
  novo: ['preparo', 'Aceitar'],
  preparo: ['_pronto', 'Pronto'],
  pronto: ['concluido', 'Concluir'],
  entrega: ['concluido', 'Entregue'],
};

function proximoStatus(p) {
  const [s, rot] = PROXIMO[p.status] || [];
  if (!s) return null;
  if (s === '_pronto') return p.tipo === 'entrega' ? ['entrega', 'Saiu p/ entrega'] : ['pronto', 'Pronto'];
  return [s, rot];
}

function telaPedidos() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const colunas = [
    { t: 'Novos', f: (p) => p.status === 'novo' },
    { t: 'Em preparo', f: (p) => p.status === 'preparo' },
    { t: 'Prontos / Em entrega', f: (p) => p.status === 'pronto' || p.status === 'entrega' },
    { t: 'Concluídos hoje', f: (p) => (p.status === 'concluido' || p.status === 'cancelado') && new Date(p.criado_em) >= hoje },
  ];
  const doDia = pedidos.filter((p) => new Date(p.criado_em) >= hoje && p.status !== 'cancelado');
  $('#conteudo').innerHTML = `
    <div class="grade-cards">
      <div class="kpi destaque"><small>Vendas hoje</small><strong>${reais(doDia.reduce((s, p) => s + p.total, 0))}</strong></div>
      <div class="kpi"><small>Pedidos hoje</small><strong>${doDia.length}</strong></div>
      <div class="kpi"><small>Ticket médio</small><strong>${reais(doDia.length ? doDia.reduce((s, p) => s + p.total, 0) / doDia.length : 0)}</strong></div>
      <div class="kpi"><small>Em andamento</small><strong>${pedidos.filter((p) => ['novo', 'preparo', 'pronto', 'entrega'].includes(p.status)).length}</strong></div>
    </div>
    <div class="kanban">${colunas
      .map((c) => {
        const lista = pedidos.filter(c.f).sort((a, b) => (c.t.startsWith('Concl') ? b.numero - a.numero : a.numero - b.numero));
        return `<section class="coluna"><div class="coluna-cab">${c.t}<span>${lista.length}</span></div>
          ${lista.map(cardPedido).join('') || '<p class="vazio" style="padding:20px 6px;font-size:13px">Nenhum pedido</p>'}</section>`;
      })
      .join('')}</div>`;
  $$('.card-ped').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest('button')) return;
      abrirPedido(el.dataset.id);
    };
    $$('button[data-s]', el).forEach((b) => (b.onclick = () => mudarStatus(el.dataset.id, b.dataset.s)));
    $('button[data-imp]', el)?.addEventListener('click', () => imprimir(pedidos.find((p) => p.id === el.dataset.id)));
  });
}

function cardPedido(p) {
  const min = minutosDesde(p.criado_em);
  const prox = proximoStatus(p);
  return `<article class="card-ped ${p.status === 'novo' ? 'novo' : ''}" data-id="${p.id}" style="border-left-color:${STATUS[p.status].cor}">
    <div class="l1"><span>#${p.numero}</span><span class="${min > 45 && !['concluido', 'cancelado'].includes(p.status) ? 'atrasado' : ''}" style="font-size:12px;font-weight:700">${hora(p.criado_em)} · ${min} min</span></div>
    <div class="l2"><span class="tag">${TIPOS[p.tipo]}${p.mesa ? ' ' + esc(p.mesa) : ''}</span> ${esc(p.cliente?.nome || 'Cliente')}<br>
      <strong style="color:var(--preto)">${reais(p.total)}</strong> · ${esc(p.pagamento || '')}${p.status === 'cancelado' ? ' · <b style="color:var(--vermelho)">Cancelado</b>' : ''}</div>
    <div class="botoes">
      ${prox ? `<button class="btn btn-p ${p.status === 'novo' ? 'btn-amarelo' : 'btn-preto'}" data-s="${prox[0]}" type="button">${prox[1]}</button>` : ''}
      ${p.status !== 'cancelado' ? '<button class="btn btn-p btn-borda" data-imp type="button" title="Imprimir">🖨️</button>' : ''}
    </div>
  </article>`;
}

async function mudarStatus(id, status) {
  const p = await db.atualizarPedido(id, { status });
  if (!p) return;
  const i = pedidos.findIndex((x) => x.id === id);
  if (i >= 0) pedidos[i] = p;
  alertarNovos();
  if (rota === 'pedidos') telaPedidos();
  toast(`Pedido #${p.numero}: ${STATUS[status].nome}`);
  if (status === 'preparo' && D.loja.imprimir_ao_aceitar) imprimir(p);
  const auto = await db.notificarClienteAutomatico(p).catch(() => false);
  if (!auto && p.cliente?.telefone && D.loja.perguntar_whats_status !== false && ['preparo', 'pronto', 'entrega', 'cancelado'].includes(status)) {
    oferecerWhats(p);
  }
}

function oferecerWhats(p) {
  const link = linkWhatsApp(p.cliente.telefone, mensagemStatusCliente(D.loja, p));
  abrirModal(
    `Avisar ${esc(p.cliente.nome.split(' ')[0])}?`,
    `<p>Enviar ao cliente pelo WhatsApp:</p><p class="codigo" style="white-space:pre-line;margin-top:10px">${esc(mensagemStatusCliente(D.loja, p))}</p>`,
    `<button class="btn btn-borda" type="button" data-f>Agora não</button><a class="btn btn-whats" href="${link}" target="_blank" rel="noopener" data-f>💬 Enviar no WhatsApp</a>`,
  );
  $$('[data-f]', $('#modal')).forEach((b) => b.addEventListener('click', () => setTimeout(fecharModal, 50)));
}

function abrirPedido(id) {
  const p = pedidos.find((x) => x.id === id);
  if (!p) return;
  const prox = proximoStatus(p);
  const m = abrirModal(
    `Pedido #${p.numero}`,
    `<div class="det-ped">
      <p><span class="pill" style="background:${STATUS[p.status].cor}22;color:${STATUS[p.status].cor}">${STATUS[p.status].nome}</span> · ${TIPOS[p.tipo]}${p.mesa ? ' ' + esc(p.mesa) : ''} · ${dataHora(p.criado_em)}</p>
      <p><strong>${esc(p.cliente?.nome || '')}</strong> ${p.cliente?.telefone ? `· ${formatarTelefone(p.cliente.telefone)}` : ''}</p>
      ${p.endereco ? `<p>📍 ${esc(textoEndereco(p.endereco))}</p>` : ''}
      <div class="itens">${p.itens
        .map((i) => `<div><span>${i.qtd}x ${esc(i.nome)}${i.adicionais.map((a) => `<small>+ ${a.qtd > 1 ? a.qtd + 'x ' : ''}${esc(a.nome)}</small>`).join('')}${i.obs ? `<small>Obs.: ${esc(i.obs)}</small>` : ''}</span><strong>${reais(i.total)}</strong></div>`)
        .join('')}</div>
      <p>Subtotal: ${reais(p.subtotal)}${p.taxa_entrega ? ` · Entrega: ${reais(p.taxa_entrega)}` : ''}${p.desconto ? ` · Desconto: −${reais(p.desconto)} (${esc(p.cupom || '')})` : ''}</p>
      <p style="font-size:18px"><strong>Total: ${reais(p.total)}</strong></p>
      <p>Pagamento: ${esc(p.pagamento)}${p.troco_para ? ` · troco para ${reais(p.troco_para)} (levar ${reais(p.troco_para - p.total)})` : ''}</p>
      ${p.obs ? `<p>📝 ${esc(p.obs)}</p>` : ''}
      ${(p.historico || []).length ? `<p style="color:var(--cinza-4);font-size:12px;margin-top:10px">${p.historico.map((h) => `${STATUS[h.status]?.nome} ${hora(h.em)}`).join(' → ')}</p>` : ''}
    </div>`,
    `${!['concluido', 'cancelado'].includes(p.status) ? '<button class="btn btn-perigo" data-cancelar type="button">Cancelar pedido</button>' : ''}
     ${p.cliente?.telefone ? `<a class="btn btn-whats" href="${linkWhatsApp(p.cliente.telefone, `Olá ${p.cliente.nome.split(' ')[0]}! Sobre o seu pedido #${p.numero} na ${D.loja.nome}:`)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
     <button class="btn btn-borda" data-imp type="button">🖨️ Imprimir</button>
     ${prox ? `<button class="btn btn-amarelo" data-s="${prox[0]}" type="button">${prox[1]}</button>` : ''}`,
  );
  $('[data-imp]', m).onclick = () => imprimir(p);
  $('[data-s]', m)?.addEventListener('click', (e) => { fecharModal(); mudarStatus(p.id, e.target.dataset.s); });
  $('[data-cancelar]', m)?.addEventListener('click', () => {
    if (!confirm(`Cancelar o pedido #${p.numero}?`)) return;
    fecharModal();
    mudarStatus(p.id, 'cancelado');
  });
}

// ---------- Impressão (impressora térmica 80 mm ou comum) ----------

function imprimir(p) {
  const L = D.loja;
  const linha = '<div class="tr"></div>';
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: 80mm auto; margin: 3mm; }
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0; color: #000; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 4px; } .c { text-align: center; } .g { font-size: 15px; font-weight: bold; }
    .tr { border-top: 1px dashed #000; margin: 6px 0; } .l { display: flex; justify-content: space-between; gap: 6px; } .s { padding-left: 10px; }
  </style></head><body>
    <h1>${esc(L.nome)}</h1><div class="c">${esc(L.telefone || '')}</div>${linha}
    <div class="c g">PEDIDO #${p.numero}</div><div class="c">${TIPOS[p.tipo].toUpperCase()}${p.mesa ? ' ' + esc(p.mesa) : ''} · ${dataHora(p.criado_em)}</div>${linha}
    <div><b>${esc(p.cliente?.nome || '')}</b></div>${p.cliente?.telefone ? `<div>${formatarTelefone(p.cliente.telefone)}</div>` : ''}
    ${p.endereco ? `<div>${esc(textoEndereco(p.endereco))}</div>` : ''}${linha}
    ${p.itens.map((i) => `<div class="l"><b>${i.qtd}x ${esc(i.nome)}</b><span>${reais(i.total)}</span></div>${i.adicionais.map((a) => `<div class="s">+ ${a.qtd > 1 ? a.qtd + 'x ' : ''}${esc(a.nome)}</div>`).join('')}${i.obs ? `<div class="s">OBS: ${esc(i.obs)}</div>` : ''}`).join('')}
    ${linha}<div class="l"><span>Subtotal</span><span>${reais(p.subtotal)}</span></div>
    ${p.taxa_entrega ? `<div class="l"><span>Entrega</span><span>${reais(p.taxa_entrega)}</span></div>` : ''}
    ${p.desconto ? `<div class="l"><span>Desconto</span><span>-${reais(p.desconto)}</span></div>` : ''}
    <div class="l g"><span>TOTAL</span><span>${reais(p.total)}</span></div>
    <div>Pagamento: ${esc(p.pagamento)}</div>${p.troco_para ? `<div>Troco para ${reais(p.troco_para)} (levar ${reais(p.troco_para - p.total)})</div>` : ''}
    ${p.obs ? `${linha}<div>OBS: ${esc(p.obs)}</div>` : ''}${linha}<div class="c">DOM Web · não é documento fiscal</div>
  </body></html>`;
  const fr = $('#frameImpressao');
  fr.srcdoc = html;
  fr.onload = () => { fr.contentWindow.focus(); fr.contentWindow.print(); };
}

// ---------- Tela: PDV / Balcão ----------

let pdv = { tipo: 'balcao', itens: [], cat: 'todas', busca: '' };

function telaPDV() {
  const cats = D.categorias.filter((c) => c.ativo).sort((a, b) => a.posicao - b.posicao);
  const prods = D.produtos
    .filter((p) => p.ativo && (pdv.cat === 'todas' || p.categoria_id === pdv.cat))
    .filter((p) => !pdv.busca || p.nome.toLowerCase().includes(pdv.busca.toLowerCase()));
  const { pedido } = calcularPedido(D, pdvEntrada(), { origem: 'pdv' });
  const bairros = D.bairros.filter((b) => b.ativo);

  $('#conteudo').innerHTML = `<div class="pdv">
    <div>
      <input class="input" id="pdvBusca" placeholder="Buscar produto…" value="${esc(pdv.busca)}" style="margin-bottom:10px">
      <div class="chips"><button type="button" data-c="todas" class="${pdv.cat === 'todas' ? 'ativo' : ''}">Todos</button>${cats.map((c) => `<button type="button" data-c="${c.id}" class="${pdv.cat === c.id ? 'ativo' : ''}">${esc(c.nome)}</button>`).join('')}</div>
      <div class="pdv-prods">${prods.map((p) => `<button type="button" class="pdv-prod" data-id="${p.id}">${p.imagem ? `<img src="${esc(p.imagem)}" alt="" loading="lazy">` : ''}<strong>${esc(p.nome)}</strong><span>${reais(precoProduto(p))}</span></button>`).join('') || '<p class="vazio">Nenhum produto</p>'}</div>
    </div>
    <aside class="cartao pdv-ticket">
      <h2>Novo pedido</h2>
      <div class="chips">${['balcao', 'mesa', 'retirada', 'entrega'].map((t) => `<button type="button" data-t="${t}" class="${pdv.tipo === t ? 'ativo' : ''}">${TIPOS[t]}</button>`).join('')}</div>
      ${pdv.tipo === 'mesa' ? `<label class="campo"><span>Número da mesa</span><input id="pdvMesa" value="${esc(pdv.mesa || '')}"></label>` : ''}
      <div class="linha"><label class="campo"><span>Cliente</span><input id="pdvNome" value="${esc(pdv.nome || '')}"></label>
      <label class="campo"><span>Telefone</span><input id="pdvTel" value="${esc(pdv.tel || '')}"></label></div>
      ${pdv.tipo === 'entrega' ? `<label class="campo"><span>Bairro</span><select id="pdvBairro"><option value="">Selecione…</option>${bairros.map((b) => `<option value="${b.id}" ${pdv.bairro === b.id ? 'selected' : ''}>${esc(b.nome)} — ${reais(b.taxa)}</option>`).join('')}</select></label>
        <div class="linha"><label class="campo" style="flex:3"><span>Rua</span><input id="pdvRua" value="${esc(pdv.rua || '')}"></label><label class="campo"><span>Nº</span><input id="pdvNum" value="${esc(pdv.num || '')}"></label></div>` : ''}
      <div>${pedido.itens.map((i, idx) => `<div class="pdv-item"><div class="info">${i.qtd}x ${esc(i.nome)}${i.adicionais.map((a) => `<small>+ ${esc(a.nome)}</small>`).join('')}</div><strong>${reais(i.total)}</strong><button class="btn btn-p btn-perigo" data-rm="${idx}" type="button">×</button></div>`).join('') || '<p class="vazio" style="padding:16px">Toque nos produtos para adicionar</p>'}</div>
      <label class="campo" style="margin-top:12px"><span>Pagamento</span><select id="pdvPag">${D.loja.pagamentos.map((p) => `<option ${pdv.pag === p.nome ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
      <div class="totais" style="font-size:14px">${pedido.taxa_entrega ? `<p>Entrega: ${reais(pedido.taxa_entrega)}</p>` : ''}<p style="font-size:22px;font-weight:900;margin:6px 0 12px">Total ${reais(pedido.total)}</p></div>
      <button class="btn btn-amarelo btn-bloco" id="pdvLancar" type="button" ${pedido.itens.length ? '' : 'disabled'}>Lançar pedido</button>
    </aside></div>`;

  const lerCampos = () => {
    pdv.nome = $('#pdvNome')?.value || '';
    pdv.tel = $('#pdvTel')?.value || '';
    pdv.mesa = $('#pdvMesa')?.value || pdv.mesa;
    pdv.bairro = $('#pdvBairro')?.value || pdv.bairro;
    pdv.rua = $('#pdvRua')?.value || pdv.rua;
    pdv.num = $('#pdvNum')?.value || pdv.num;
    pdv.pag = $('#pdvPag')?.value || pdv.pag;
  };
  $('#pdvBusca').oninput = (e) => {
    pdv.busca = e.target.value;
    lerCampos();
    telaPDV();
    $('#pdvBusca').focus();
    $('#pdvBusca').setSelectionRange(pdv.busca.length, pdv.busca.length);
  };
  $$('[data-c]').forEach((b) => (b.onclick = () => { lerCampos(); pdv.cat = b.dataset.c; telaPDV(); }));
  $$('[data-t]').forEach((b) => (b.onclick = () => { lerCampos(); pdv.tipo = b.dataset.t; telaPDV(); }));
  $$('[data-rm]').forEach((b) => (b.onclick = () => { lerCampos(); pdv.itens.splice(Number(b.dataset.rm), 1); telaPDV(); }));
  $('#pdvBairro')?.addEventListener('change', () => { lerCampos(); telaPDV(); });
  $$('.pdv-prod').forEach((b) => (b.onclick = () => { lerCampos(); escolherOpcoesPDV(b.dataset.id); }));
  $('#pdvLancar').onclick = async () => {
    lerCampos();
    try {
      const p = await db.criarPedidoInterno(pdvEntrada());
      pedidos.unshift(p);
      toast(`Pedido #${p.numero} lançado`);
      if (confirm('Pedido lançado! Imprimir agora?')) imprimir(p);
      pdv = { tipo: pdv.tipo, itens: [], cat: pdv.cat, busca: '' };
      telaPDV();
    } catch (e) {
      toast(e.message, true);
    }
  };
}

function pdvEntrada() {
  return {
    tipo: pdv.tipo,
    mesa: pdv.mesa,
    cliente: { nome: pdv.nome || (pdv.tipo === 'mesa' ? `Mesa ${pdv.mesa || ''}` : 'Balcão'), telefone: pdv.tel },
    endereco: pdv.tipo === 'entrega' ? { bairro_id: pdv.bairro, rua: pdv.rua, numero: pdv.num } : null,
    itens: pdv.itens,
    pagamento: pdv.pag || D.loja.pagamentos[0]?.nome,
  };
}

function escolherOpcoesPDV(id) {
  const p = D.produtos.find((x) => x.id === id);
  const grupos = (p.grupos || []).filter((g) => g.itens.some((o) => o.ativo));
  if (!grupos.length) {
    pdv.itens.push({ produto_id: id, escolhas: {}, qtd: 1, obs: '' });
    return telaPDV();
  }
  const m = abrirModal(
    esc(p.nome),
    grupos
      .map((g) => `<div style="margin-bottom:14px"><strong>${esc(g.nome)}</strong> <small style="color:var(--cinza-4)">${g.min ? `obrigatório · ` : ''}até ${g.max}</small>
        ${g.itens.filter((o) => o.ativo).map((o) => `<label class="opc-ed" style="cursor:pointer"><input type="${g.max === 1 ? 'radio' : 'checkbox'}" name="${g.id}" value="${o.id}" data-g="${g.id}"> ${esc(o.nome)} ${o.preco ? `<small>+${reais(o.preco)}</small>` : ''}</label>`).join('')}</div>`)
      .join('') + `<label class="campo"><span>Observação</span><input id="pdvObs"></label>`,
    `<button class="btn btn-amarelo" id="pdvOk" type="button">Adicionar</button>`,
  );
  $('#pdvOk', m).onclick = () => {
    const escolhas = {};
    $$('input[data-g]:checked', m).forEach((i) => ((escolhas[i.dataset.g] = escolhas[i.dataset.g] || {})[i.value] = 1));
    const { erros } = montarItem(p, escolhas, 1);
    if (erros.length) return toast(erros.join('\n'), true);
    pdv.itens.push({ produto_id: id, escolhas, qtd: 1, obs: $('#pdvObs', m).value });
    fecharModal();
    telaPDV();
  };
}

// ---------- Tela: Cardápio ----------

function telaCardapio() {
  const cats = [...D.categorias].sort((a, b) => a.posicao - b.posicao);
  $('#conteudo').innerHTML = `
    <div class="cab-secao"><input class="input" id="buscaProd" placeholder="Buscar produto…" style="max-width:320px"><span class="esp"></span>
      <button class="btn btn-borda" id="novaCat" type="button">+ Categoria</button><button class="btn btn-amarelo" id="novoProd" type="button">+ Produto</button></div>
    ${cats
      .map((c, ci) => {
        const prods = D.produtos.filter((p) => p.categoria_id === c.id).sort((a, b) => a.posicao - b.posicao);
        return `<section class="cat-bloco" data-cat="${c.id}">
        <div class="cat-cab"><h3>${esc(c.nome)} <small style="color:var(--cinza-2);font-weight:500">(${prods.length})${c.ativo ? '' : ' · oculta'}</small></h3>
          <button class="btn btn-borda" data-sobe type="button" ${ci === 0 ? 'disabled' : ''} title="Subir">↑</button>
          <button class="btn btn-borda" data-desce type="button" ${ci === cats.length - 1 ? 'disabled' : ''} title="Descer">↓</button>
          <button class="btn btn-amarelo" data-editcat type="button">Editar</button></div>
        ${prods
          .map(
            (p) => `<div class="prod-linha ${p.ativo ? '' : 'pausado'}" data-p="${p.id}" data-nome="${esc(p.nome.toLowerCase())}">
            ${p.imagem ? `<img src="${esc(p.imagem)}" alt="" loading="lazy">` : '<div class="sem-img">🍔</div>'}
            <div class="info"><strong>${esc(p.nome)}</strong><small>${reais(precoProduto(p))}${p.preco_promocional ? ` (de ${reais(p.preco)})` : ''}${p.grupos?.length ? ` · ${p.grupos.length} grupo(s) de adicionais` : ''}</small></div>
            <label class="chave" title="${p.ativo ? 'Disponível' : 'Pausado'}"><input type="checkbox" data-ativo ${p.ativo ? 'checked' : ''}><span></span></label>
            <button class="btn btn-p btn-borda" data-editprod type="button">Editar</button></div>`,
          )
          .join('') || '<p class="vazio" style="padding:14px">Sem produtos</p>'}
      </section>`;
      })
      .join('')}`;

  $('#buscaProd').oninput = (e) => {
    const t = e.target.value.toLowerCase();
    $$('.prod-linha').forEach((l) => l.classList.toggle('oculto', !!t && !l.dataset.nome.includes(t)));
  };
  $('#novaCat').onclick = () => editarCategoria();
  $('#novoProd').onclick = () => editarProduto();
  $$('.cat-bloco').forEach((s) => {
    const c = D.categorias.find((x) => x.id === s.dataset.cat);
    $('[data-editcat]', s).onclick = () => editarCategoria(c);
    const mover = async (d) => {
      const ord = [...D.categorias].sort((a, b) => a.posicao - b.posicao);
      const i = ord.indexOf(c);
      [ord[i], ord[i + d]] = [ord[i + d], ord[i]];
      ord.forEach((x, k) => (x.posicao = k + 1));
      await salvar('Ordem atualizada');
      telaCardapio();
    };
    $('[data-sobe]', s).onclick = () => mover(-1);
    $('[data-desce]', s).onclick = () => mover(1);
  });
  $$('.prod-linha').forEach((l) => {
    const p = D.produtos.find((x) => x.id === l.dataset.p);
    $('[data-editprod]', l).onclick = () => editarProduto(p);
    $('[data-ativo]', l).onchange = async (e) => {
      p.ativo = e.target.checked;
      l.classList.toggle('pausado', !p.ativo);
      await salvar(p.ativo ? `${p.nome} disponível` : `${p.nome} pausado`);
    };
  });
}

function editarCategoria(c = null) {
  const m = abrirModal(
    c ? 'Editar categoria' : 'Nova categoria',
    `<label class="campo"><span>Nome</span><input id="catNome" value="${esc(c?.nome || '')}"></label>
     <label class="opc-ed"><input type="checkbox" id="catAtiva" ${c?.ativo !== false ? 'checked' : ''}> Mostrar no cardápio</label>`,
    `${c ? '<button class="btn btn-perigo" id="catExcluir" type="button">Excluir</button>' : ''}<button class="btn btn-amarelo" id="catSalvar" type="button">Salvar</button>`,
  );
  $('#catSalvar', m).onclick = async () => {
    const nome = $('#catNome', m).value.trim();
    if (!nome) return toast('Informe o nome', true);
    if (c) Object.assign(c, { nome, ativo: $('#catAtiva', m).checked });
    else D.categorias.push({ id: novoId('cat'), nome, ativo: $('#catAtiva', m).checked, posicao: D.categorias.length + 1 });
    await salvar();
    fecharModal();
    telaCardapio();
  };
  $('#catExcluir', m)?.addEventListener('click', async () => {
    if (D.produtos.some((p) => p.categoria_id === c.id)) return toast('Mova ou exclua os produtos desta categoria primeiro', true);
    D.categorias = D.categorias.filter((x) => x !== c);
    await salvar('Categoria excluída');
    fecharModal();
    telaCardapio();
  });
}

function editarProduto(p = null) {
  const rascunho = p ? structuredClone(p) : { id: novoId('prd'), nome: '', descricao: '', preco: 0, preco_promocional: null, imagem: '', ativo: true, destaque: false, categoria_id: D.categorias[0]?.id, grupos: [] };
  const m = abrirModal(
    p ? 'Editar produto' : 'Novo produto',
    `<div class="linha"><label class="campo" style="flex:2"><span>Nome</span><input id="pNome" value="${esc(rascunho.nome)}"></label>
      <label class="campo"><span>Categoria</span><select id="pCat">${D.categorias.map((c) => `<option value="${c.id}" ${c.id === rascunho.categoria_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label></div>
     <label class="campo"><span>Descrição</span><textarea id="pDesc">${esc(rascunho.descricao)}</textarea></label>
     <div class="linha"><label class="campo"><span>Preço (R$)</span><input id="pPreco" type="number" step="0.01" min="0" value="${rascunho.preco}"></label>
      <label class="campo"><span>Preço promocional (opcional)</span><input id="pPromo" type="number" step="0.01" min="0" value="${rascunho.preco_promocional ?? ''}"></label></div>
     <div class="campo"><span>Foto</span><div class="linha" style="align-items:center">
       <img id="pImgPrev" src="${esc(rascunho.imagem)}" alt="" style="max-width:90px;height:70px;object-fit:cover;border-radius:10px;flex:0 0 90px;${rascunho.imagem ? '' : 'display:none'}">
       <input type="file" id="pImg" accept="image/*"><button class="btn btn-p btn-borda" id="pImgRm" type="button" style="flex:0">Remover</button></div></div>
     <label class="opc-ed"><input type="checkbox" id="pAtivo" ${rascunho.ativo ? 'checked' : ''}> Disponível para venda</label>
     <label class="opc-ed"><input type="checkbox" id="pDest" ${rascunho.destaque ? 'checked' : ''}> Marcar como destaque</label>
     <h3 style="margin:18px 0 8px;font-size:15px">Adicionais e opções</h3>
     <div id="grupos"></div>
     <button class="btn btn-borda btn-p" id="addGrupo" type="button">+ Grupo de opções (ex.: "Escolha o pão", "Adicionais")</button>`,
    `${p ? '<button class="btn btn-perigo" id="pExcluir" type="button">Excluir</button>' : ''}<button class="btn btn-borda" id="pDup" type="button" ${p ? '' : 'hidden'}>Duplicar</button><button class="btn btn-amarelo" id="pSalvar" type="button">Salvar produto</button>`,
    true,
  );

  const pintarGrupos = () => {
    $('#grupos', m).innerHTML = rascunho.grupos
      .map(
        (g, gi) => `<div class="grupo-ed" data-gi="${gi}">
        <div class="linha"><label class="campo" style="flex:2;margin:0"><span>Nome do grupo</span><input data-f="nome" value="${esc(g.nome)}"></label>
          <label class="campo" style="margin:0"><span>Mínimo</span><input data-f="min" type="number" min="0" value="${g.min}"></label>
          <label class="campo" style="margin:0"><span>Máximo</span><input data-f="max" type="number" min="1" value="${g.max}"></label>
          <button class="btn btn-p btn-perigo" data-rmg type="button" style="flex:0">Excluir</button></div>
        ${g.itens.map((o, oi) => `<div class="opc-ed" data-oi="${oi}"><input type="text" class="input" data-o="nome" placeholder="Opção" value="${esc(o.nome)}"><input type="number" class="input" step="0.01" min="0" data-o="preco" placeholder="+ R$" value="${o.preco}"><label class="chave"><input type="checkbox" data-o="ativo" ${o.ativo ? 'checked' : ''}><span></span></label><button class="btn btn-p btn-borda" data-rmo type="button">×</button></div>`).join('')}
        <button class="btn btn-p btn-borda" data-addo type="button" style="margin-top:8px">+ Opção</button></div>`,
      )
      .join('');
    $$('.grupo-ed', m).forEach((el) => {
      const g = rascunho.grupos[el.dataset.gi];
      $$('[data-f]', el).forEach((i) => (i.oninput = () => (g[i.dataset.f] = i.type === 'number' ? Number(i.value) : i.value)));
      $$('.opc-ed', el).forEach((oe) => {
        const o = g.itens[oe.dataset.oi];
        $$('[data-o]', oe).forEach((i) => (i.oninput = i.onchange = () => (o[i.dataset.o] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Number(i.value) : i.value)));
        $('[data-rmo]', oe).onclick = () => { g.itens.splice(oe.dataset.oi, 1); pintarGrupos(); };
      });
      $('[data-addo]', el).onclick = () => { g.itens.push({ id: novoId('opc'), nome: '', preco: 0, ativo: true }); pintarGrupos(); };
      $('[data-rmg]', el).onclick = () => { rascunho.grupos.splice(el.dataset.gi, 1); pintarGrupos(); };
    });
  };
  pintarGrupos();
  $('#addGrupo', m).onclick = () => { rascunho.grupos.push({ id: novoId('grp'), nome: 'Adicionais', min: 0, max: 3, itens: [{ id: novoId('opc'), nome: '', preco: 0, ativo: true }] }); pintarGrupos(); };
  $('#pImg', m).onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      toast('Enviando foto…');
      rascunho.imagem = await db.enviarImagem(f);
      $('#pImgPrev', m).src = rascunho.imagem;
      $('#pImgPrev', m).style.display = '';
      toast('Foto pronta');
    } catch (err) {
      toast(err.message, true);
    }
  };
  $('#pImgRm', m).onclick = () => { rascunho.imagem = ''; $('#pImgPrev', m).style.display = 'none'; };
  $('#pSalvar', m).onclick = async () => {
    Object.assign(rascunho, {
      nome: $('#pNome', m).value.trim(),
      categoria_id: $('#pCat', m).value,
      descricao: $('#pDesc', m).value.trim(),
      preco: arred($('#pPreco', m).value),
      preco_promocional: $('#pPromo', m).value ? arred($('#pPromo', m).value) : null,
      ativo: $('#pAtivo', m).checked,
      destaque: $('#pDest', m).checked,
    });
    rascunho.grupos = rascunho.grupos
      .map((g) => ({ ...g, nome: g.nome.trim(), min: Math.max(0, g.min || 0), max: Math.max(1, g.max || 1, g.min || 0), itens: g.itens.filter((o) => o.nome.trim()).map((o) => ({ ...o, nome: o.nome.trim(), preco: arred(o.preco) })) }))
      .filter((g) => g.nome && g.itens.length);
    if (!rascunho.nome) return toast('Informe o nome do produto', true);
    if (p) Object.assign(p, rascunho);
    else D.produtos.push({ ...rascunho, posicao: Math.max(0, ...D.produtos.map((x) => x.posicao)) + 1 });
    await salvar('Produto salvo');
    fecharModal();
    telaCardapio();
  };
  $('#pExcluir', m)?.addEventListener('click', async () => {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    D.produtos = D.produtos.filter((x) => x !== p);
    await salvar('Produto excluído');
    fecharModal();
    telaCardapio();
  });
  $('#pDup', m).onclick = async () => {
    D.produtos.push({ ...structuredClone(p), id: novoId('prd'), nome: `${p.nome} (cópia)`, posicao: p.posicao + 0.5 });
    await salvar('Produto duplicado');
    fecharModal();
    telaCardapio();
  };
}

// ---------- Tela: Entrega ----------

function telaEntrega() {
  const L = D.loja;
  $('#conteudo').innerHTML = `<div class="grade-2">
    <section class="cartao"><h2>Como a loja atende</h2>
      <label class="opc-ed"><input type="checkbox" id="eEnt" ${L.aceita_entrega ? 'checked' : ''}> Entrega (delivery)</label>
      <label class="opc-ed"><input type="checkbox" id="eRet" ${L.aceita_retirada ? 'checked' : ''}> Retirada no local</label>
      <label class="opc-ed"><input type="checkbox" id="eMesa" ${L.aceita_mesa ? 'checked' : ''}> Pedido na mesa (QR Code)</label>
      <div class="linha" style="margin-top:14px"><label class="campo"><span>Tempo de entrega</span><input id="eTEnt" value="${esc(L.tempo_entrega || '')}"></label>
      <label class="campo"><span>Tempo de retirada</span><input id="eTRet" value="${esc(L.tempo_retirada || '')}"></label></div>
      <div class="linha"><label class="campo"><span>Pedido mínimo (R$)</span><input id="eMin" type="number" step="0.01" value="${L.pedido_minimo || 0}"></label>
      <label class="campo"><span>Entrega grátis acima de (R$)</span><input id="eGratis" type="number" step="0.01" value="${L.entrega_gratis_acima ?? ''}" placeholder="vazio = nunca"></label></div>
      <label class="opc-ed"><input type="checkbox" id="eRef" ${L.referencia_obrigatoria ? 'checked' : ''}> Ponto de referência obrigatório</label>
      <button class="btn btn-amarelo" id="eSalvar" type="button" style="margin-top:14px">Salvar</button>
    </section>
    <section class="cartao"><h2>Bairros e taxas de entrega</h2>
      <table class="tabela"><thead><tr><th>Bairro</th><th style="width:110px">Taxa (R$)</th><th>Ativo</th><th></th></tr></thead>
      <tbody id="bairros">${D.bairros.map((b, i) => `<tr data-i="${i}"><td><input class="input" data-f="nome" value="${esc(b.nome)}"></td><td><input class="input" data-f="taxa" type="number" step="0.5" min="0" value="${b.taxa}"></td><td><label class="chave"><input type="checkbox" data-f="ativo" ${b.ativo ? 'checked' : ''}><span></span></label></td><td><button class="btn btn-p btn-perigo" data-rm type="button">×</button></td></tr>`).join('')}</tbody></table>
      <div class="cab-secao" style="margin-top:12px"><button class="btn btn-borda btn-p" id="addBairro" type="button">+ Bairro</button><span class="esp"></span><button class="btn btn-amarelo" id="salvarBairros" type="button">Salvar bairros</button></div>
    </section></div>`;
  $('#eSalvar').onclick = async () => {
    Object.assign(L, {
      aceita_entrega: $('#eEnt').checked, aceita_retirada: $('#eRet').checked, aceita_mesa: $('#eMesa').checked,
      tempo_entrega: $('#eTEnt').value, tempo_retirada: $('#eTRet').value, pedido_minimo: arred($('#eMin').value),
      entrega_gratis_acima: $('#eGratis').value ? arred($('#eGratis').value) : null, referencia_obrigatoria: $('#eRef').checked,
    });
    await salvar();
  };
  const ler = () => $$('#bairros tr').forEach((tr) => {
    const b = D.bairros[tr.dataset.i];
    b.nome = $('[data-f=nome]', tr).value.trim();
    b.taxa = arred($('[data-f=taxa]', tr).value);
    b.ativo = $('[data-f=ativo]', tr).checked;
  });
  $$('#bairros [data-rm]').forEach((b) => (b.onclick = () => { ler(); D.bairros.splice(b.closest('tr').dataset.i, 1); telaEntrega(); }));
  $('#addBairro').onclick = () => { ler(); D.bairros.push({ id: novoId('bai'), nome: '', taxa: 0, ativo: true }); telaEntrega(); };
  $('#salvarBairros').onclick = async () => { ler(); D.bairros = D.bairros.filter((b) => b.nome); await salvar('Bairros salvos'); telaEntrega(); };
}

// ---------- Tela: Cupons ----------

function telaCupons() {
  $('#conteudo').innerHTML = `<section class="cartao"><h2>Cupons de desconto</h2><div class="rolagem">
    <table class="tabela"><thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Pedido mínimo</th><th>Usos</th><th>Ativo</th><th></th></tr></thead>
    <tbody id="cupons">${D.cupons.map((c, i) => `<tr data-i="${i}"><td><input class="input" data-f="codigo" value="${esc(c.codigo)}" style="text-transform:uppercase"></td>
      <td><select class="input" data-f="tipo"><option value="percentual" ${c.tipo === 'percentual' ? 'selected' : ''}>%</option><option value="valor" ${c.tipo === 'valor' ? 'selected' : ''}>R$</option></select></td>
      <td><input class="input" data-f="valor" type="number" step="0.01" min="0" value="${c.valor}"></td><td><input class="input" data-f="minimo" type="number" step="0.01" min="0" value="${c.minimo || 0}"></td>
      <td>${pedidos.filter((p) => p.cupom === c.codigo && p.status !== 'cancelado').length}</td>
      <td><label class="chave"><input type="checkbox" data-f="ativo" ${c.ativo ? 'checked' : ''}><span></span></label></td><td><button class="btn btn-p btn-perigo" data-rm type="button">×</button></td></tr>`).join('')}</tbody></table></div>
    ${D.cupons.length ? '' : '<p class="vazio">Nenhum cupom. Crie um para atrair clientes (ex.: PRIMEIRACOMPRA 10%).</p>'}
    <div class="cab-secao" style="margin-top:12px"><button class="btn btn-borda btn-p" id="addCupom" type="button">+ Cupom</button><span class="esp"></span><button class="btn btn-amarelo" id="salvarCupons" type="button">Salvar cupons</button></div></section>`;
  const ler = () => $$('#cupons tr').forEach((tr) => {
    const c = D.cupons[tr.dataset.i];
    c.codigo = $('[data-f=codigo]', tr).value.trim().toUpperCase().replace(/\s+/g, '');
    c.tipo = $('[data-f=tipo]', tr).value;
    c.valor = arred($('[data-f=valor]', tr).value);
    c.minimo = arred($('[data-f=minimo]', tr).value);
    c.ativo = $('[data-f=ativo]', tr).checked;
  });
  $$('#cupons [data-rm]').forEach((b) => (b.onclick = () => { ler(); D.cupons.splice(b.closest('tr').dataset.i, 1); telaCupons(); }));
  $('#addCupom').onclick = () => { ler(); D.cupons.push({ id: novoId('cup'), codigo: '', tipo: 'percentual', valor: 10, minimo: 0, ativo: true }); telaCupons(); };
  $('#salvarCupons').onclick = async () => { ler(); D.cupons = D.cupons.filter((c) => c.codigo); await salvar('Cupons salvos'); telaCupons(); };
}

// ---------- Tela: Clientes ----------

function clientesDe(lista) {
  const mapa = new Map();
  for (const p of lista) {
    if (p.status === 'cancelado') continue;
    const tel = p.cliente?.telefone;
    if (!tel) continue;
    const c = mapa.get(tel) || { nome: p.cliente.nome, telefone: tel, pedidos: 0, total: 0, ultimo: p.criado_em, bairro: p.endereco?.bairro || '' };
    c.pedidos++;
    c.total += p.total;
    if (p.criado_em > c.ultimo) { c.ultimo = p.criado_em; c.nome = p.cliente.nome; }
    mapa.set(tel, c);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

function telaClientes() {
  const lista = clientesDe(pedidos);
  $('#conteudo').innerHTML = `<section class="cartao"><div class="cab-secao"><h2 style="margin:0">Clientes <small>${lista.length} nos últimos 90 dias</small></h2><span class="esp"></span>
    <input class="input" id="buscaCli" placeholder="Buscar nome ou telefone" style="max-width:260px"><button class="btn btn-borda btn-p" id="csv" type="button">Exportar planilha</button></div>
    <div class="rolagem"><table class="tabela"><thead><tr><th>Cliente</th><th>WhatsApp</th><th>Pedidos</th><th>Total gasto</th><th>Último pedido</th><th></th></tr></thead>
    <tbody>${lista.map((c) => `<tr data-b="${esc((c.nome + c.telefone).toLowerCase())}"><td><strong>${esc(c.nome)}</strong>${c.bairro ? `<br><small style="color:var(--cinza-4)">${esc(c.bairro)}</small>` : ''}</td><td>${formatarTelefone(c.telefone)}</td><td>${c.pedidos}</td><td>${reais(c.total)}</td><td>${dataHora(c.ultimo)}</td>
      <td><a class="btn btn-p btn-whats" target="_blank" rel="noopener" href="${linkWhatsApp(c.telefone, `Olá ${c.nome.split(' ')[0]}! Aqui é da ${D.loja.nome} 🍔`)}">💬</a></td></tr>`).join('')}</tbody></table></div>
    ${lista.length ? '' : '<p class="vazio">Os clientes aparecem aqui conforme fazem pedidos.</p>'}</section>`;
  $('#buscaCli').oninput = (e) => $$('tbody tr').forEach((tr) => tr.classList.toggle('oculto', !tr.dataset.b.includes(e.target.value.toLowerCase())));
  $('#csv').onclick = () => {
    const linhas = [['Nome', 'WhatsApp', 'Bairro', 'Pedidos', 'Total', 'Último pedido'], ...lista.map((c) => [c.nome, c.telefone, c.bairro, c.pedidos, c.total.toFixed(2).replace('.', ','), dataHora(c.ultimo)])];
    const csv = '﻿' + linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'clientes-domweb.csv';
    a.click();
  };
}

// ---------- Tela: Relatórios ----------

let periodo = 7;
function telaRelatorios() {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - (periodo - 1));
  const lista = pedidos.filter((p) => new Date(p.criado_em) >= inicio);
  const validos = lista.filter((p) => p.status !== 'cancelado');
  const fat = validos.reduce((s, p) => s + p.total, 0);
  const agrupar = (fn) => {
    const m = new Map();
    validos.forEach((p) => fn(p).forEach(([k, v, q = 1]) => { const a = m.get(k) || { v: 0, q: 0 }; a.v += v; a.q += q; m.set(k, a); }));
    return [...m.entries()].sort((a, b) => b[1].v - a[1].v);
  };
  const prods = agrupar((p) => p.itens.map((i) => [i.nome, i.total, i.qtd])).slice(0, 10);
  const pags = agrupar((p) => [[p.pagamento || '—', p.total]]);
  const tipos = agrupar((p) => [[TIPOS[p.tipo], p.total]]);
  const porDia = [];
  for (let i = 0; i < periodo; i++) {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    const prox = new Date(d);
    prox.setDate(prox.getDate() + 1);
    porDia.push({ rot: periodo <= 7 ? DIAS_SEMANA[d.getDay()].slice(0, 3) : String(d.getDate()), v: validos.filter((p) => new Date(p.criado_em) >= d && new Date(p.criado_em) < prox).reduce((s, p) => s + p.total, 0) });
  }
  const maxDia = Math.max(1, ...porDia.map((x) => x.v));
  const rank = (arr, moeda = true) => arr.map(([k, a]) => `<div><span>${esc(k)}${a.q && !moeda ? '' : ''}</span><strong>${moeda ? reais(a.v) : a.q}</strong></div>`).join('') || '<p class="vazio">Sem dados</p>';

  $('#conteudo').innerHTML = `
    <div class="chips">${[[1, 'Hoje'], [7, '7 dias'], [30, '30 dias'], [90, '90 dias']].map(([n, t]) => `<button type="button" data-p="${n}" class="${periodo === n ? 'ativo' : ''}">${t}</button>`).join('')}</div>
    <div class="grade-cards">
      <div class="kpi destaque"><small>Faturamento</small><strong>${reais(fat)}</strong></div>
      <div class="kpi"><small>Pedidos</small><strong>${validos.length}</strong></div>
      <div class="kpi"><small>Ticket médio</small><strong>${reais(validos.length ? fat / validos.length : 0)}</strong></div>
      <div class="kpi"><small>Taxas de entrega</small><strong>${reais(validos.reduce((s, p) => s + (p.taxa_entrega || 0), 0))}</strong></div>
      <div class="kpi"><small>Cancelados</small><strong>${lista.length - validos.length}</strong></div>
      <div class="kpi"><small>Clientes</small><strong>${clientesDe(validos).length}</strong></div>
    </div>
    ${periodo > 1 ? `<section class="cartao"><h2>Vendas por dia</h2><div class="barras" style="margin-bottom:22px">${porDia.map((x) => `<div style="height:${(x.v / maxDia) * 100}%" title="${reais(x.v)}"><span>${x.rot}</span></div>`).join('')}</div></section>` : ''}
    <div class="grade-2">
      <section class="cartao"><h2>Mais vendidos <small>quantidade</small></h2><div class="lista-rank">${prods.map(([k, a]) => `<div><span>${esc(k)}</span><strong>${a.q} · ${reais(a.v)}</strong></div>`).join('') || '<p class="vazio">Sem dados</p>'}</div></section>
      <section class="cartao"><h2>Por forma de pagamento</h2><div class="lista-rank">${rank(pags)}</div>
        <h2 style="margin-top:18px">Por tipo de pedido</h2><div class="lista-rank">${rank(tipos)}</div></section>
    </div>`;
  $$('[data-p]').forEach((b) => (b.onclick = () => { periodo = Number(b.dataset.p); telaRelatorios(); }));
}

// ---------- Tela: WhatsApp e IA ----------

function telaWhatsApp() {
  const base = location.origin;
  $('#conteudo').innerHTML = `<div class="grade-2">
    <section class="cartao"><h2>1. Pedidos pelo WhatsApp <span class="ok-tag">● funcionando</span></h2>
      <p style="font-size:14px">Quando o cliente finaliza o pedido no cardápio, ele recebe um botão para enviar o pedido completo para o WhatsApp da loja: <strong>${esc(formatarTelefone(D.loja.whatsapp))}</strong>.</p>
      <p style="font-size:14px;margin-top:8px">No painel, a cada mudança de status (aceito, saiu para entrega…) aparece o botão para avisar o cliente no WhatsApp com a mensagem pronta.</p>
      <label class="opc-ed" style="margin-top:10px"><input type="checkbox" id="wPerg" ${D.loja.perguntar_whats_status !== false ? 'checked' : ''}> Perguntar se quero avisar o cliente ao mudar o status</label>
      <label class="opc-ed"><input type="checkbox" id="wImp" ${D.loja.imprimir_ao_aceitar ? 'checked' : ''}> Imprimir automaticamente ao aceitar o pedido</label>
      <h3 style="font-size:14px;margin:14px 0 6px">Link do cardápio para colocar na bio e no WhatsApp Business</h3>
      <div class="codigo">${esc(base)}/</div>
      <h3 style="font-size:14px;margin:14px 0 6px">Link para mesas (troque o número)</h3>
      <div class="codigo">${esc(base)}/?mesa=1</div>
      <button class="btn btn-amarelo" id="wSalvar" type="button" style="margin-top:14px">Salvar</button>
    </section>
    <section class="cartao"><h2>2. Atendente com IA no WhatsApp ${CFG.whatsappApi ? '<span class="ok-tag">● conectado</span>' : '<span class="nao-tag">● não conectado</span>'}</h2>
      <p style="font-size:14px">Responde clientes 24h: manda o cardápio, tira dúvidas sobre produtos, preços, horários e taxa de entrega, e envia o link para fazer o pedido. Também avisa o cliente automaticamente a cada mudança de status.</p>
      <ol class="passos" style="margin-top:12px;padding-left:18px">
        <li>Crie um app em <strong>developers.facebook.com</strong> e adicione o produto <strong>WhatsApp</strong> (API oficial da Meta).</li>
        <li>Cadastre o número da loja (precisa ser um número que não esteja em uso no aplicativo do WhatsApp).</li>
        <li>No Netlify, em <em>Site configuration › Environment variables</em>, crie: <code>WHATSAPP_TOKEN</code>, <code>WHATSAPP_PHONE_ID</code>, <code>WHATSAPP_VERIFY_TOKEN</code> (uma senha que você inventa) e <code>ANTHROPIC_API_KEY</code> (IA Claude).</li>
        <li>Na Meta, em <em>Webhooks</em>, cole a URL abaixo, use o mesmo <code>WHATSAPP_VERIFY_TOKEN</code> e assine o campo <strong>messages</strong>.</li>
      </ol>
      <div class="codigo">${esc(base)}/.netlify/functions/whatsapp</div>
      <p style="font-size:13px;color:var(--cinza-4);margin-top:10px">Custo estimado: conversas iniciadas pelo cliente são grátis na Meta; a IA (Claude Haiku) custa cerca de R$ 0,02 por conversa.</p>
    </section></div>`;
  $('#wSalvar').onclick = async () => {
    D.loja.perguntar_whats_status = $('#wPerg').checked;
    D.loja.imprimir_ao_aceitar = $('#wImp').checked;
    await salvar();
  };
}

// ---------- Tela: Minha loja ----------

function telaLoja() {
  const L = D.loja;
  $('#conteudo').innerHTML = `<div class="grade-2">
    <section class="cartao"><h2>Dados da loja</h2>
      <label class="campo"><span>Nome</span><input id="lNome" value="${esc(L.nome)}"></label>
      <label class="campo"><span>Descrição</span><textarea id="lDesc">${esc(L.descricao)}</textarea></label>
      <div class="linha"><label class="campo"><span>Telefone</span><input id="lTel" value="${esc(L.telefone)}"></label>
      <label class="campo"><span>WhatsApp que recebe pedidos</span><input id="lWhats" value="${esc(L.whatsapp)}" placeholder="5588999999999"></label></div>
      <label class="campo"><span>Instagram (sem @)</span><input id="lInsta" value="${esc(L.instagram || '')}"></label>
      <div class="linha"><label class="campo" style="flex:3"><span>Rua</span><input id="lRua" value="${esc(L.endereco.rua)}"></label><label class="campo"><span>Número</span><input id="lNum" value="${esc(L.endereco.numero)}"></label></div>
      <div class="linha"><label class="campo"><span>Bairro</span><input id="lBairro" value="${esc(L.endereco.bairro)}"></label><label class="campo"><span>Complemento</span><input id="lComp" value="${esc(L.endereco.complemento)}"></label></div>
      <div class="linha"><label class="campo" style="flex:3"><span>Cidade</span><input id="lCid" value="${esc(L.endereco.cidade)}"></label><label class="campo"><span>UF</span><input id="lUf" maxlength="2" value="${esc(L.endereco.uf)}"></label></div>
      <div class="linha"><div class="campo"><span>Logo</span><img src="${esc(L.logo)}" alt="" id="lLogoPrev" style="width:70px;height:70px;border-radius:50%;object-fit:cover"><input type="file" id="lLogo" accept="image/*"></div>
      <div class="campo"><span>Foto de capa</span><img src="${esc(L.capa)}" alt="" id="lCapaPrev" style="width:100%;height:70px;border-radius:10px;object-fit:cover"><input type="file" id="lCapa" accept="image/*"></div></div>
    </section>
    <div>
      <section class="cartao"><h2>Horário de funcionamento</h2>
        <table class="tabela">${DIAS_SEMANA.map((d, i) => {
          const f = L.horarios?.[i] || [];
          return `<tr data-d="${i}"><td><strong>${d}</strong></td><td><label class="opc-ed" style="margin:0"><input type="checkbox" data-aberto ${f.length ? 'checked' : ''}> Abre</label></td>
            <td><input class="input" type="time" data-de value="${f[0]?.de || '18:00'}"></td><td><input class="input" type="time" data-ate value="${f[0]?.ate || '23:00'}"></td></tr>`;
        }).join('')}</table>
        <p style="font-size:12px;color:var(--cinza-4);margin-top:8px">Fechamento depois da meia-noite funciona (ex.: 18:00 às 02:00).</p>
      </section>
      <section class="cartao"><h2>Formas de pagamento</h2>
        <div id="pags">${L.pagamentos.map((p, i) => `<div class="opc-ed" data-i="${i}"><input type="text" class="input" data-f="nome" value="${esc(p.nome)}"><select class="input" data-f="tipo" style="flex:1">${['dinheiro', 'pix', 'credito', 'debito', 'outro'].map((t) => `<option ${p.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="btn btn-p btn-perigo" data-rm type="button">×</button></div>`).join('')}</div>
        <button class="btn btn-p btn-borda" id="addPag" type="button" style="margin-top:8px">+ Forma de pagamento</button>
        <label class="campo" style="margin-top:14px"><span>Chave Pix (aparece para o cliente)</span><input id="lPix" value="${esc(L.chave_pix || '')}"></label>
      </section>
    </div></div>
    <button class="btn btn-amarelo" id="lSalvar" type="button">Salvar dados da loja</button>`;

  const lerPags = () => $$('#pags .opc-ed').forEach((el) => {
    const p = L.pagamentos[el.dataset.i];
    p.nome = $('[data-f=nome]', el).value.trim();
    p.tipo = $('[data-f=tipo]', el).value;
  });
  $$('#pags [data-rm]').forEach((b) => (b.onclick = () => { lerPags(); L.pagamentos.splice(b.closest('.opc-ed').dataset.i, 1); telaLoja(); }));
  $('#addPag').onclick = () => { lerPags(); L.pagamentos.push({ nome: '', tipo: 'outro' }); telaLoja(); };
  const foto = (inp, prev, campo) => ($(inp).onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    L[campo] = await db.enviarImagem(f);
    $(prev).src = L[campo];
  });
  foto('#lLogo', '#lLogoPrev', 'logo');
  foto('#lCapa', '#lCapaPrev', 'capa');
  $('#lSalvar').onclick = async () => {
    lerPags();
    Object.assign(L, {
      nome: $('#lNome').value.trim(), descricao: $('#lDesc').value.trim(), telefone: $('#lTel').value.trim(),
      whatsapp: $('#lWhats').value.replace(/\D/g, ''), instagram: $('#lInsta').value.trim().replace(/^@/, ''), chave_pix: $('#lPix').value.trim(),
    });
    L.endereco = { rua: $('#lRua').value, numero: $('#lNum').value, bairro: $('#lBairro').value, complemento: $('#lComp').value, cidade: $('#lCid').value, uf: $('#lUf').value.toUpperCase() };
    L.pagamentos = L.pagamentos.filter((p) => p.nome);
    L.horarios = {};
    $$('tr[data-d]').forEach((tr) => {
      L.horarios[tr.dataset.d] = $('[data-aberto]', tr).checked ? [{ de: $('[data-de]', tr).value, ate: $('[data-ate]', tr).value }] : [];
    });
    await salvar('Dados da loja salvos');
    pintarLojaMini();
  };
}
