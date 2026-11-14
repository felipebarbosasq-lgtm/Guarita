// DOM Web: cardápio digital do cliente.
import { carregarCardapio, criarPedido, validarCupom } from './dados.js';
import { reais, precoProduto, situacaoLoja, montarItem, calcularPedido, DIAS_SEMANA, agoraBrasilia } from './nucleo.js';
import { $, $$, esc, toast, formatarTelefone } from './ui.js';

const K_CARRINHO = 'domweb:carrinho';
const K_CLIENTE = 'domweb:cliente';
const params = new URLSearchParams(location.search);
const MESA = params.get('mesa');

let D; // dados do cardápio
let carrinho = lerJSON(K_CARRINHO, { tipo: 'entrega', itens: [], cupom: '' });
let cupomAplicado = null;
if (MESA) carrinho.tipo = 'mesa';

function lerJSON(k, p) {
  try { return JSON.parse(localStorage.getItem(k)) ?? p; } catch { return p; }
}
const salvarCarrinho = () => localStorage.setItem(K_CARRINHO, JSON.stringify(carrinho));

// ---------- Início ----------

init().catch((e) => {
  console.error(e);
  $('#lista').innerHTML = `<p class="vazio">Não foi possível carregar o cardápio.<br>${esc(e.message)}</p>`;
});

async function init() {
  D = await carregarCardapio();
  const L = D.loja;
  document.title = `${L.nome} · Cardápio`;
  $('#nomeLoja').textContent = L.nome;
  $('#logo').src = L.logo || '/img/logo.jpg';
  $('#logo').alt = L.nome;
  if (L.capa) $('#capaImg').style.backgroundImage = `url("${L.capa}")`;

  // remove do carrinho itens que não existem mais
  carrinho.itens = carrinho.itens.filter((i) => D.produtos.some((p) => p.id === i.produto_id && p.ativo));
  if (!MESA && carrinho.tipo === 'mesa') carrinho.tipo = 'entrega';
  if (carrinho.tipo === 'entrega' && !L.aceita_entrega) carrinho.tipo = 'retirada';
  if (carrinho.tipo === 'retirada' && !L.aceita_retirada) carrinho.tipo = 'entrega';

  pintarStatus();
  setInterval(pintarStatus, 60_000);
  pintarResumo();
  pintarModo();
  pintarCardapio();
  pintarBarra();

  $('#btnInfo').onclick = abrirInfo;
  $('#busca').oninput = () => pintarCardapio($('#busca').value);
  $('#barraCarrinho').onclick = abrirCarrinho;
  $('#fundo').onclick = fecharFolha;
  document.addEventListener('keydown', (e) => e.key === 'Escape' && fecharFolha());
}

function pintarStatus() {
  const s = situacaoLoja(D.loja);
  const el = $('#status');
  el.className = `pill ${s.aberta ? 'pill-aberto' : 'pill-fechado'}`;
  el.textContent = s.motivo;
}

function pintarResumo() {
  const L = D.loja;
  const partes = [];
  if (MESA) partes.push(`🍽️ Mesa ${esc(MESA)}`);
  if (L.pedido_minimo) partes.push(`Pedido mínimo ${reais(L.pedido_minimo)}`);
  if (L.aceita_entrega && L.tempo_entrega) partes.push(`🛵 ${esc(L.tempo_entrega)}`);
  if (L.aceita_retirada && L.tempo_retirada) partes.push(`🏪 Retirada ${esc(L.tempo_retirada)}`);
  if (L.entrega_gratis_acima) partes.push(`Entrega grátis acima de ${reais(L.entrega_gratis_acima)}`);
  $('#resumoLoja').innerHTML = partes.map((p) => `<span>${p}</span>`).join('');
}

function pintarModo() {
  const el = $('#modo');
  if (MESA) {
    el.classList.add('oculto');
    return;
  }
  $$('button', el).forEach((b) => {
    const t = b.dataset.tipo;
    const ok = t === 'entrega' ? D.loja.aceita_entrega : D.loja.aceita_retirada;
    b.classList.toggle('oculto', !ok);
    b.setAttribute('aria-selected', String(carrinho.tipo === t));
    b.onclick = () => {
      carrinho.tipo = t;
      salvarCarrinho();
      pintarModo();
    };
  });
}

function htmlPreco(p) {
  const final = precoProduto(p);
  const temGrupoComPreco = p.grupos?.some((g) => g.min > 0 && g.itens.some((o) => o.preco > 0));
  return `${temGrupoComPreco ? 'A partir de ' : ''}${reais(final)}${final < p.preco ? `<s>${reais(p.preco)}</s>` : ''}`;
}

function pintarCardapio(busca = '') {
  const termo = busca.trim().toLowerCase();
  const cats = D.categorias.filter((c) => c.ativo).sort((a, b) => a.posicao - b.posicao);
  let html = '';
  const usadas = [];
  for (const c of cats) {
    const prods = D.produtos
      .filter((p) => p.categoria_id === c.id && (p.ativo || p.mostrar_indisponivel))
      .filter((p) => !termo || `${p.nome} ${p.descricao}`.toLowerCase().includes(termo))
      .sort((a, b) => a.posicao - b.posicao);
    if (!prods.length) continue;
    usadas.push(c);
    html += `<section class="categoria" id="c-${c.id}"><h2>${esc(c.nome)}</h2>`;
    for (const p of prods) {
      html += `<button type="button" class="produto ${p.ativo ? '' : 'indisp'}" data-id="${p.id}" ${p.ativo ? '' : 'disabled'}>
        <div class="produto-txt">
          ${p.destaque ? '<span class="selo">⭐ Destaque</span>' : ''}
          <h3>${esc(p.nome)}</h3>
          ${p.descricao ? `<p class="desc">${esc(p.descricao)}</p>` : ''}
          <div class="preco">${p.ativo ? htmlPreco(p) : 'Indisponível'}</div>
        </div>
        ${p.imagem ? `<img src="${esc(p.imagem)}" alt="" loading="lazy">` : ''}
      </button>`;
    }
    html += '</section>';
  }
  $('#lista').innerHTML = html || `<p class="vazio">Nenhum produto encontrado.</p>`;
  $('#cats').innerHTML = usadas.map((c, i) => `<a href="#c-${c.id}" class="${i === 0 ? 'ativa' : ''}">${esc(c.nome)}</a>`).join('');
  $$('.produto').forEach((b) => (b.onclick = () => abrirProduto(b.dataset.id)));
  observarCategorias();
}

let obs;
function observarCategorias() {
  obs?.disconnect();
  obs = new IntersectionObserver(
    (ents) => {
      for (const e of ents) {
        if (!e.isIntersecting) continue;
        $$('#cats a').forEach((a) => {
          const ativa = a.getAttribute('href') === `#${e.target.id}`;
          a.classList.toggle('ativa', ativa);
          if (ativa) a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        });
      }
    },
    { rootMargin: '-70px 0px -70% 0px' },
  );
  $$('.categoria').forEach((s) => obs.observe(s));
}

// ---------- Folha (modal) ----------

function abrirFolha(titulo, corpo, pe = '') {
  const f = $('#folha');
  f.innerHTML = `<div class="folha-topo"><h2 id="folhaTitulo">${titulo}</h2><button class="fechar" type="button" aria-label="Fechar">×</button></div>
    <div class="folha-corpo">${corpo}</div>${pe ? `<div class="folha-pe">${pe}</div>` : ''}`;
  $('.fechar', f).onclick = fecharFolha;
  f.classList.add('ver');
  $('#fundo').classList.add('ver');
  document.body.style.overflow = 'hidden';
  return f;
}

function fecharFolha() {
  $('#folha').classList.remove('ver');
  $('#fundo').classList.remove('ver');
  document.body.style.overflow = '';
}

// ---------- Produto ----------

function abrirProduto(id, edicao = null) {
  const p = D.produtos.find((x) => x.id === id);
  if (!p) return;
  const escolhas = edicao ? structuredClone(edicao.escolhas) : {};
  let qtd = edicao?.qtd || 1;
  const grupos = (p.grupos || []).filter((g) => g.itens.some((o) => o.ativo));

  const corpo = `
    ${p.imagem ? `<img class="det-img" src="${esc(p.imagem)}" alt="">` : ''}
    <h3 style="font-size:20px;font-weight:900">${esc(p.nome)}</h3>
    ${p.descricao ? `<p class="det-desc">${esc(p.descricao)}</p>` : ''}
    <div class="preco">${htmlPreco(p)}</div>
    ${grupos
      .map((g) => {
        const unico = g.max === 1;
        return `<div class="grupo" data-g="${g.id}">
          <div class="grupo-cab"><div><h4>${esc(g.nome)}</h4><small>${g.min > 0 ? `Escolha ${g.min === g.max ? g.min : `de ${g.min} a ${g.max}`}` : `Opcional · até ${g.max}`}</small></div>
          ${g.min > 0 ? '<span class="obrig">Obrigatório</span>' : ''}</div>
          ${g.itens
            .filter((o) => o.ativo)
            .map(
              (o) => `<label class="opcao">
              <span class="nome">${esc(o.nome)}${o.preco ? `<small>+ ${reais(o.preco)}</small>` : ''}</span>
              ${
                unico
                  ? `<input type="radio" name="g-${g.id}" value="${o.id}" ${escolhas[g.id]?.[o.id] ? 'checked' : ''}>`
                  : g.max > 1 && o.preco > 0
                    ? `<span class="stepper p" data-o="${o.id}"><button type="button" data-d="-1">−</button><span>${escolhas[g.id]?.[o.id] || 0}</span><button type="button" data-d="1">+</button></span>`
                    : `<input type="checkbox" value="${o.id}" ${escolhas[g.id]?.[o.id] ? 'checked' : ''}>`
              }
            </label>`,
            )
            .join('')}
        </div>`;
      })
      .join('')}
    <div class="campo" style="margin-top:16px"><span>Alguma observação?</span>
      <textarea id="obsItem" maxlength="300" placeholder="Ex.: sem cebola, ponto da carne…">${esc(edicao?.obs || '')}</textarea></div>`;

  const pe = `<span class="stepper" id="qtdItem"><button type="button" data-d="-1" aria-label="Diminuir">−</button><span>${qtd}</span><button type="button" data-d="1" aria-label="Aumentar">+</button></span>
    <button class="btn btn-amarelo btn-bloco" id="btnAdd" type="button"></button>`;
  const f = abrirFolha(edicao ? 'Editar item' : 'Adicionar ao pedido', corpo, pe);

  const atualizar = () => {
    const { item, erros } = montarItem(p, escolhas, qtd, '');
    $('#btnAdd', f).textContent = `${edicao ? 'Salvar' : 'Adicionar'} · ${reais(item.total)}`;
    $('#btnAdd', f).dataset.erros = erros.join('\n');
    $('#qtdItem span', f).textContent = qtd;
    for (const g of grupos) {
      const tot = Object.values(escolhas[g.id] || {}).reduce((s, n) => s + n, 0);
      const tag = $(`[data-g="${g.id}"] .obrig`, f);
      if (tag) {
        tag.classList.toggle('ok', tot >= g.min);
        tag.textContent = tot >= g.min ? '✓ Ok' : 'Obrigatório';
      }
      // bloqueia novas escolhas ao atingir o máximo
      $$(`[data-g="${g.id}"] input[type=checkbox]`, f).forEach((c) => (c.disabled = !c.checked && tot >= g.max));
    }
  };

  for (const g of grupos) {
    const box = $(`[data-g="${g.id}"]`, f);
    $$('input', box).forEach((inp) => {
      inp.onchange = () => {
        if (inp.type === 'radio') escolhas[g.id] = { [inp.value]: 1 };
        else {
          escolhas[g.id] = escolhas[g.id] || {};
          if (inp.checked) escolhas[g.id][inp.value] = 1;
          else delete escolhas[g.id][inp.value];
        }
        atualizar();
      };
    });
    $$('.stepper', box).forEach((st) => {
      $$('button', st).forEach((b) => {
        b.onclick = (e) => {
          e.preventDefault();
          escolhas[g.id] = escolhas[g.id] || {};
          const tot = Object.values(escolhas[g.id]).reduce((s, n) => s + n, 0);
          const d = Number(b.dataset.d);
          const atual = escolhas[g.id][st.dataset.o] || 0;
          if (d > 0 && tot >= g.max) return toast(`Máximo de ${g.max} em "${g.nome}"`);
          const novo = Math.max(0, atual + d);
          if (novo) escolhas[g.id][st.dataset.o] = novo;
          else delete escolhas[g.id][st.dataset.o];
          $('span', st).textContent = novo;
          atualizar();
        };
      });
    });
  }
  $$('#qtdItem button', f).forEach((b) => (b.onclick = () => { qtd = Math.max(1, Math.min(99, qtd + Number(b.dataset.d))); atualizar(); }));
  $('#btnAdd', f).onclick = () => {
    const erros = $('#btnAdd', f).dataset.erros;
    if (erros) return toast(erros, true);
    const obsTxt = $('#obsItem', f).value.trim();
    if (edicao) Object.assign(edicao, { escolhas, qtd, obs: obsTxt });
    else carrinho.itens.push({ chave: Math.random().toString(36).slice(2), produto_id: p.id, escolhas, qtd, obs: obsTxt });
    salvarCarrinho();
    pintarBarra();
    if (edicao) abrirCarrinho();
    else {
      fecharFolha();
      toast(`${p.nome} adicionado 🍔`);
    }
  };
  atualizar();
}

// ---------- Carrinho ----------

function entradaPedido(extra = {}) {
  return { tipo: carrinho.tipo, mesa: MESA, itens: carrinho.itens, cupom: cupomAplicado?.codigo || '', ...extra };
}

function pintarBarra() {
  const n = carrinho.itens.reduce((s, i) => s + i.qtd, 0);
  const { pedido } = calcularPedido(D, entradaPedido(), { origem: 'pdv' });
  $('#barraCarrinho').classList.toggle('oculto', n === 0);
  $('#barraQtd').textContent = n;
  $('#barraTotal').textContent = reais(pedido.subtotal);
}

function abrirCarrinho() {
  if (!carrinho.itens.length) return fecharFolha();
  const { pedido } = calcularPedido(D, entradaPedido(), { origem: 'pdv' });
  const corpo = `
    ${pedido.itens
      .map((i, idx) => {
        const c = carrinho.itens[idx];
        return `<div class="item-car" data-k="${c.chave}">
        <div class="info"><h4>${esc(i.nome)}</h4>
          ${i.adicionais.map((a) => `<small>+ ${a.qtd > 1 ? a.qtd + 'x ' : ''}${esc(a.nome)}</small>`).join('')}
          ${i.obs ? `<small>Obs.: ${esc(i.obs)}</small>` : ''}
          <button type="button" class="link-info" data-editar style="color:var(--preto);margin-top:6px">Editar</button></div>
        <div class="lado"><strong>${reais(i.total)}</strong>
          <span class="stepper p"><button type="button" data-d="-1" aria-label="Diminuir">−</button><span>${i.qtd}</span><button type="button" data-d="1" aria-label="Aumentar">+</button></span></div>
      </div>`;
      })
      .join('')}
    <button type="button" class="btn btn-borda btn-p" id="maisItens" style="margin-top:12px">+ Adicionar mais itens</button>
    <div class="cupom"><input class="input" id="cupom" placeholder="Cupom de desconto" value="${esc(cupomAplicado?.codigo || '')}"><button class="btn btn-preto" id="aplicarCupom" type="button">Aplicar</button></div>
    <div class="totais">
      <div><span>Subtotal</span><span>${reais(pedido.subtotal)}</span></div>
      ${pedido.desconto ? `<div><span>Desconto (${esc(pedido.cupom)})</span><span>− ${reais(pedido.desconto)}</span></div>` : ''}
      ${carrinho.tipo === 'entrega' ? '<div><span>Entrega</span><span>calculada no próximo passo</span></div>' : ''}
      <div class="total"><span>Total</span><span>${reais(pedido.subtotal - pedido.desconto)}</span></div>
    </div>`;
  const f = abrirFolha('Seu pedido', corpo, `<button class="btn btn-amarelo btn-bloco" id="continuar" type="button">Continuar</button>`);

  $$('.item-car', f).forEach((el) => {
    const c = carrinho.itens.find((x) => x.chave === el.dataset.k);
    $$('.stepper button', el).forEach(
      (b) =>
        (b.onclick = () => {
          c.qtd += Number(b.dataset.d);
          if (c.qtd <= 0) carrinho.itens = carrinho.itens.filter((x) => x !== c);
          salvarCarrinho();
          pintarBarra();
          abrirCarrinho();
        }),
    );
    $('[data-editar]', el).onclick = () => abrirProduto(c.produto_id, c);
  });
  $('#maisItens', f).onclick = fecharFolha;
  $('#aplicarCupom', f).onclick = async () => {
    const cod = $('#cupom', f).value.trim();
    if (!cod) {
      cupomAplicado = null;
      return abrirCarrinho();
    }
    const c = await validarCupom(cod, pedido.subtotal);
    if (!c) return toast('Cupom inválido', true);
    if (c.minimo && pedido.subtotal < c.minimo) return toast(`Cupom válido para pedidos acima de ${reais(c.minimo)}`, true);
    cupomAplicado = c;
    if (!D.cupons.some((x) => x.codigo === c.codigo)) D.cupons.push(c);
    toast('Cupom aplicado!');
    abrirCarrinho();
  };
  $('#continuar', f).onclick = () => {
    if (D.loja.pedido_minimo && pedido.subtotal < D.loja.pedido_minimo && carrinho.tipo !== 'mesa') {
      return toast(`Pedido mínimo de ${reais(D.loja.pedido_minimo)}`, true);
    }
    abrirCheckout();
  };
}

// ---------- Finalização ----------

function abrirCheckout() {
  const L = D.loja;
  const cli = lerJSON(K_CLIENTE, {});
  const situacao = situacaoLoja(L);
  const bairros = (D.bairros || []).filter((b) => b.ativo);
  const ehEntrega = carrinho.tipo === 'entrega';
  const ehMesa = carrinho.tipo === 'mesa';

  const corpo = `
    ${!situacao.aberta ? `<div class="aviso">⏰ ${esc(situacao.motivo)}. Seu pedido não pode ser enviado agora.</div>` : ''}
    <h3 class="secao-t">Seus dados</h3>
    <label class="campo"><span>Nome</span><input id="cNome" autocomplete="name" value="${esc(cli.nome || '')}" maxlength="80"></label>
    <label class="campo"><span>WhatsApp</span><input id="cTel" type="tel" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000" value="${esc(formatarTelefone(cli.telefone || ''))}"></label>
    ${
      ehEntrega
        ? `<h3 class="secao-t">Endereço de entrega</h3>
      <label class="campo"><span>Bairro</span><select id="cBairro"><option value="">Selecione…</option>${bairros
        .map((b) => `<option value="${b.id}" ${cli.bairro_id === b.id ? 'selected' : ''}>${esc(b.nome)} — ${b.taxa ? reais(b.taxa) : 'grátis'}</option>`)
        .join('')}</select></label>
      <div class="linha"><label class="campo" style="flex:3"><span>Rua</span><input id="cRua" autocomplete="address-line1" value="${esc(cli.rua || '')}"></label>
      <label class="campo" style="flex:1"><span>Número</span><input id="cNum" value="${esc(cli.numero || '')}"></label></div>
      <label class="campo"><span>Complemento</span><input id="cComp" placeholder="Casa, apto…" value="${esc(cli.complemento || '')}"></label>
      <label class="campo"><span>Ponto de referência${L.referencia_obrigatoria ? '' : ' (opcional)'}</span><input id="cRef" value="${esc(cli.referencia || '')}"></label>`
        : ehMesa
          ? `<div class="aviso">🍽️ Pedido para a <strong>mesa ${esc(MESA)}</strong>.</div>`
          : `<div class="aviso">🏪 Retirar em: ${esc([L.endereco.rua, L.endereco.numero, L.endereco.bairro, L.endereco.cidade].filter(Boolean).join(', '))}</div>`
    }
    <h3 class="secao-t">Pagamento ${ehMesa ? '(opcional)' : ''}</h3>
    <div class="opcoes-pag">${(L.pagamentos || [])
      .map((p) => `<label><input type="radio" name="pag" value="${esc(p.nome)}" data-tipo="${p.tipo}" ${cli.pagamento === p.nome ? 'checked' : ''}>${esc(p.nome)}</label>`)
      .join('')}</div>
    <div id="boxTroco" class="campo oculto" style="margin-top:12px"><span>Troco para quanto? (deixe vazio se não precisar)</span><input id="cTroco" inputmode="decimal" placeholder="Ex.: 50"></div>
    <div id="boxPix" class="aviso oculto" style="margin-top:12px"></div>
    <label class="campo" style="margin-top:14px"><span>Observações do pedido (opcional)</span><textarea id="cObs" maxlength="300"></textarea></label>
    <div class="totais" id="totaisCheckout"></div>`;

  const f = abrirFolha('Finalizar pedido', corpo, `<button class="btn btn-amarelo btn-bloco" id="enviar" type="button" ${situacao.aberta ? '' : 'disabled'}>Enviar pedido</button>`);

  const tel = $('#cTel', f);
  tel.oninput = () => (tel.value = formatarTelefone(tel.value));

  const entrada = () => ({
    ...entradaPedido(),
    cliente: { nome: $('#cNome', f).value, telefone: $('#cTel', f).value },
    endereco: ehEntrega
      ? { bairro_id: $('#cBairro', f).value, rua: $('#cRua', f).value, numero: $('#cNum', f).value, complemento: $('#cComp', f).value, referencia: $('#cRef', f).value }
      : null,
    pagamento: $('input[name=pag]:checked', f)?.value || '',
    troco_para: Number(String($('#cTroco', f).value).replace(',', '.')) || null,
    obs: $('#cObs', f).value,
  });

  const atualizar = () => {
    const pag = $('input[name=pag]:checked', f);
    $('#boxTroco', f).classList.toggle('oculto', pag?.dataset.tipo !== 'dinheiro');
    const pix = pag?.dataset.tipo === 'pix' && L.chave_pix;
    $('#boxPix', f).classList.toggle('oculto', !pix);
    if (pix) $('#boxPix', f).innerHTML = `Chave Pix: <strong>${esc(L.chave_pix)}</strong><br>Envie o comprovante pelo WhatsApp após o pedido.`;
    const { pedido } = calcularPedido(D, entrada(), { origem: 'pdv' });
    $('#totaisCheckout', f).innerHTML = `
      <div><span>Subtotal</span><span>${reais(pedido.subtotal)}</span></div>
      ${ehEntrega ? `<div><span>Entrega</span><span>${$('#cBairro', f).value ? (pedido.taxa_entrega ? reais(pedido.taxa_entrega) : 'Grátis') : 'escolha o bairro'}</span></div>` : ''}
      ${pedido.desconto ? `<div><span>Desconto</span><span>− ${reais(pedido.desconto)}</span></div>` : ''}
      <div class="total"><span>Total</span><span>${reais(pedido.total)}</span></div>`;
  };
  f.addEventListener('input', atualizar);
  f.addEventListener('change', atualizar);
  atualizar();

  $('#enviar', f).onclick = async () => {
    const e = entrada();
    if (ehMesa && !e.pagamento) e.pagamento = 'Pagar na mesa';
    const { erros } = calcularPedido(D, e);
    if (erros.length) return toast(erros.join('\n'), true);
    const btn = $('#enviar', f);
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      localStorage.setItem(
        K_CLIENTE,
        JSON.stringify({ nome: e.cliente.nome, telefone: e.cliente.telefone, pagamento: e.pagamento, ...(e.endereco || {}) }),
      );
      const pedido = await criarPedido(e);
      carrinho.itens = [];
      cupomAplicado = null;
      salvarCarrinho();
      location.href = `/pedido.html?id=${encodeURIComponent(pedido.id)}&novo=1`;
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
      btn.textContent = 'Enviar pedido';
    }
  };
}

// ---------- Informações ----------

function abrirInfo() {
  const L = D.loja;
  const hoje = agoraBrasilia().dia;
  const end = [L.endereco.rua && `${L.endereco.rua}, ${L.endereco.numero}`, L.endereco.complemento, L.endereco.bairro, L.endereco.cidade && `${L.endereco.cidade} - ${L.endereco.uf}`].filter(Boolean).join(' · ');
  abrirFolha(
    esc(L.nome),
    `<div class="info-lista">
      ${L.descricao ? `<p style="color:var(--cinza-6)">${esc(L.descricao)}</p>` : ''}
      <h3>Horário de funcionamento</h3>
      <table class="horarios">${DIAS_SEMANA.map((d, i) => {
        const fx = L.horarios?.[i] || [];
        return `<tr class="${i === hoje ? 'hoje' : ''}"><td>${d}</td><td>${fx.length ? fx.map((x) => `${x.de} às ${x.ate}`).join(', ') : 'Fechado'}</td></tr>`;
      }).join('')}</table>
      ${end ? `<h3>Endereço</h3><p>${esc(end)}</p>` : ''}
      <h3>Formas de pagamento</h3><p>${(L.pagamentos || []).map((p) => esc(p.nome)).join(' · ')}</p>
      ${L.telefone ? `<h3>Contato</h3><p>${esc(L.telefone)}${L.instagram ? ` · Instagram <a href="https://instagram.com/${esc(L.instagram)}" target="_blank" rel="noopener">@${esc(L.instagram)}</a>` : ''}</p>` : ''}
    </div>`,
  );
}
