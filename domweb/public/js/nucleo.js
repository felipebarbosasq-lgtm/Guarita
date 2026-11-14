// DOM Web: regras do negócio compartilhadas entre o navegador e as funções do servidor.
// Nada aqui depende do navegador: o mesmo cálculo de preço roda no site e no servidor.

export const STATUS = {
  novo: { nome: 'Novo', cor: '#FFC400' },
  preparo: { nome: 'Em preparo', cor: '#FF8A00' },
  pronto: { nome: 'Pronto', cor: '#2D9CDB' },
  entrega: { nome: 'Saiu para entrega', cor: '#9B51E0' },
  concluido: { nome: 'Concluído', cor: '#27AE60' },
  cancelado: { nome: 'Cancelado', cor: '#EB5757' },
};

export const TIPOS = { entrega: 'Entrega', retirada: 'Retirada', mesa: 'Mesa', balcao: 'Balcão' };

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const arred = (v) => Math.round((Number(v) || 0) * 100) / 100;

export function reais(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function precoProduto(p) {
  return p.preco_promocional != null && p.preco_promocional > 0 && p.preco_promocional < p.preco ? p.preco_promocional : p.preco;
}

// ---------- Horário de funcionamento (fuso de Brasília) ----------

export function agoraBrasilia(data = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(data);
  const get = (t) => partes.find((p) => p.type === t)?.value;
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { dia, minutos: Number(get('hour')) * 60 + Number(get('minute')) };
}

const paraMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
};

// Retorna { aberta, motivo, proxima } considerando horários que passam da meia-noite.
export function situacaoLoja(loja, data = new Date()) {
  if (loja.status_manual === 'aberta') return { aberta: true, motivo: 'Aberto agora' };
  if (loja.status_manual === 'fechada') return { aberta: false, motivo: 'Fechado no momento' };
  const { dia, minutos } = agoraBrasilia(data);
  const h = loja.horarios || {};
  for (const f of h[dia] || []) {
    const de = paraMin(f.de);
    let ate = paraMin(f.ate);
    if (ate <= de) ate += 24 * 60;
    if (minutos >= de && minutos < ate) return { aberta: true, motivo: `Aberto até ${f.ate}` };
  }
  const ontem = (dia + 6) % 7;
  for (const f of h[ontem] || []) {
    const de = paraMin(f.de);
    const ate = paraMin(f.ate);
    if (ate <= de && minutos < ate) return { aberta: true, motivo: `Aberto até ${f.ate}` };
  }
  for (let i = 0; i < 7; i++) {
    const d = (dia + i) % 7;
    const faixas = (h[d] || []).filter((f) => i > 0 || paraMin(f.de) > minutos);
    if (faixas.length) {
      const quando = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS_SEMANA[d].toLowerCase();
      return { aberta: false, motivo: `Fechado · abre ${quando} às ${faixas[0].de}` };
    }
  }
  return { aberta: false, motivo: 'Fechado no momento' };
}

// ---------- Cálculo do pedido ----------

// Monta um item do carrinho a partir das escolhas do cliente, validando contra o cardápio.
// escolhas: { [grupoId]: { [opcaoId]: quantidade } }
export function montarItem(produto, escolhas = {}, qtd = 1, obs = '') {
  const erros = [];
  if (!produto || !produto.ativo) erros.push('Produto indisponível');
  const adicionais = [];
  for (const g of produto?.grupos || []) {
    const sel = escolhas[g.id] || {};
    let total = 0;
    for (const o of g.itens) {
      const q = Math.max(0, Math.floor(Number(sel[o.id]) || 0));
      if (!q) continue;
      if (!o.ativo) erros.push(`${o.nome} indisponível`);
      total += q;
      adicionais.push({ grupo: g.nome, grupo_id: g.id, opcao_id: o.id, nome: o.nome, preco: arred(o.preco), qtd: q });
    }
    if (total < (g.min || 0)) erros.push(`Escolha ao menos ${g.min} em "${g.nome}"`);
    if (g.max && total > g.max) erros.push(`Escolha no máximo ${g.max} em "${g.nome}"`);
  }
  const quantidade = Math.max(1, Math.min(99, Math.floor(Number(qtd) || 1)));
  const unit = arred(precoProduto(produto || { preco: 0 }) + adicionais.reduce((s, a) => s + a.preco * a.qtd, 0));
  return {
    erros,
    item: {
      produto_id: produto?.id,
      nome: produto?.nome,
      qtd: quantidade,
      preco_unit: unit,
      adicionais,
      obs: String(obs || '').slice(0, 300),
      total: arred(unit * quantidade),
    },
  };
}

export function calcularDesconto(cupom, subtotal) {
  if (!cupom || !cupom.ativo) return 0;
  if (cupom.minimo && subtotal < cupom.minimo) return 0;
  const v = cupom.tipo === 'percentual' ? (subtotal * cupom.valor) / 100 : cupom.valor;
  return arred(Math.min(v, subtotal));
}

export function taxaEntrega(dados, tipo, bairroId, subtotal) {
  if (tipo !== 'entrega') return 0;
  const b = (dados.bairros || []).find((x) => x.id === bairroId && x.ativo);
  if (!b) return null;
  const gratis = dados.loja.entrega_gratis_acima;
  if (gratis && subtotal >= gratis) return 0;
  return arred(b.taxa);
}

// Recalcula e valida o pedido inteiro. Usado no navegador (prévia) e no servidor (valor final).
// entrada: { tipo, cliente{nome,telefone}, endereco{rua,numero,bairro_id,complemento,referencia},
//            itens:[{produto_id, escolhas, qtd, obs}], pagamento, troco_para, cupom, obs, mesa }
export function calcularPedido(dados, entrada, { origem = 'cardapio' } = {}) {
  const erros = [];
  const loja = dados.loja;
  const tipo = TIPOS[entrada.tipo] ? entrada.tipo : 'entrega';
  if (origem === 'cardapio') {
    if (tipo === 'entrega' && !loja.aceita_entrega) erros.push('A loja não está fazendo entregas');
    if (tipo === 'retirada' && !loja.aceita_retirada) erros.push('A loja não está aceitando retirada');
    if (tipo === 'mesa' && !loja.aceita_mesa) erros.push('A loja não está aceitando pedidos na mesa');
    const sit = situacaoLoja(loja);
    if (!sit.aberta) erros.push(`A loja está fechada (${sit.motivo})`);
  }

  const itens = [];
  for (const e of entrada.itens || []) {
    const p = (dados.produtos || []).find((x) => x.id === e.produto_id);
    const { erros: es, item } = montarItem(p, e.escolhas, e.qtd, e.obs);
    erros.push(...es);
    itens.push({ ...item, escolhas: e.escolhas || {} });
  }
  if (!itens.length) erros.push('O carrinho está vazio');

  const subtotal = arred(itens.reduce((s, i) => s + i.total, 0));
  if (origem === 'cardapio' && tipo !== 'mesa' && loja.pedido_minimo && subtotal < loja.pedido_minimo) {
    erros.push(`Pedido mínimo de ${reais(loja.pedido_minimo)}`);
  }

  let taxa = taxaEntrega(dados, tipo, entrada.endereco?.bairro_id, subtotal);
  if (taxa === null) {
    erros.push('Escolha um bairro atendido');
    taxa = 0;
  }

  let cupom = null;
  if (entrada.cupom) {
    cupom = (dados.cupons || []).find((c) => c.codigo.toUpperCase() === String(entrada.cupom).trim().toUpperCase());
    if (!cupom || !cupom.ativo) erros.push('Cupom inválido');
    else if (cupom.minimo && subtotal < cupom.minimo) erros.push(`O cupom vale para pedidos acima de ${reais(cupom.minimo)}`);
  }
  const desconto = calcularDesconto(cupom, subtotal);
  const total = arred(subtotal + taxa - desconto);

  const cliente = {
    nome: String(entrada.cliente?.nome || '').trim().slice(0, 80),
    telefone: String(entrada.cliente?.telefone || '').replace(/\D/g, '').slice(0, 13),
  };
  if (origem === 'cardapio') {
    if (cliente.nome.length < 2) erros.push('Informe seu nome');
    if (tipo !== 'mesa' && cliente.telefone.length < 10) erros.push('Informe um WhatsApp válido com DDD');
  }

  let endereco = null;
  if (tipo === 'entrega') {
    const b = (dados.bairros || []).find((x) => x.id === entrada.endereco?.bairro_id);
    endereco = {
      rua: String(entrada.endereco?.rua || '').trim().slice(0, 120),
      numero: String(entrada.endereco?.numero || '').trim().slice(0, 20),
      bairro_id: b?.id || null,
      bairro: b?.nome || '',
      complemento: String(entrada.endereco?.complemento || '').trim().slice(0, 120),
      referencia: String(entrada.endereco?.referencia || '').trim().slice(0, 160),
    };
    if (origem === 'cardapio') {
      if (!endereco.rua) erros.push('Informe a rua');
      if (!endereco.numero) erros.push('Informe o número');
      if (loja.referencia_obrigatoria && !endereco.referencia) erros.push('Informe um ponto de referência');
    }
  }

  const formas = (loja.pagamentos || []).map((p) => p.nome);
  const pagamento = String(entrada.pagamento || '');
  if (origem === 'cardapio' && tipo !== 'mesa' && !formas.includes(pagamento)) erros.push('Escolha a forma de pagamento');
  let troco_para = null;
  const formaInfo = (loja.pagamentos || []).find((p) => p.nome === pagamento);
  if (formaInfo?.tipo === 'dinheiro' && entrada.troco_para) {
    troco_para = arred(entrada.troco_para);
    if (troco_para < total) erros.push('O valor para troco é menor que o total');
  }

  return {
    erros: [...new Set(erros)],
    pedido: {
      tipo,
      cliente,
      endereco,
      mesa: tipo === 'mesa' ? String(entrada.mesa || '').slice(0, 10) : null,
      itens,
      subtotal,
      taxa_entrega: taxa,
      desconto,
      cupom: cupom ? cupom.codigo : null,
      total,
      pagamento,
      troco_para,
      obs: String(entrada.obs || '').trim().slice(0, 300),
    },
  };
}

// ---------- Textos ----------

export function textoItens(itens) {
  return itens
    .map((i) => {
      let t = `${i.qtd}x ${i.nome} — ${reais(i.total)}`;
      for (const a of i.adicionais || []) t += `\n   + ${a.qtd > 1 ? a.qtd + 'x ' : ''}${a.nome}${a.preco ? ` (${reais(a.preco * a.qtd)})` : ''}`;
      if (i.obs) t += `\n   Obs: ${i.obs}`;
      return t;
    })
    .join('\n');
}

export function textoEndereco(e) {
  if (!e) return '';
  return [`${e.rua}, ${e.numero}`, e.complemento, e.bairro, e.referencia ? `Ref.: ${e.referencia}` : ''].filter(Boolean).join(' · ');
}

// Mensagem enviada para o WhatsApp da loja quando o cliente finaliza o pedido.
export function mensagemPedidoWhatsApp(loja, p, linkAcompanhar = '') {
  const linhas = [
    `*Novo pedido #${p.numero}* — ${loja.nome}`,
    '',
    `*${TIPOS[p.tipo]}*${p.mesa ? ` · Mesa ${p.mesa}` : ''}`,
    `Cliente: ${p.cliente.nome}`,
    `WhatsApp: ${p.cliente.telefone}`,
  ];
  if (p.endereco) linhas.push(`Endereço: ${textoEndereco(p.endereco)}`);
  linhas.push('', textoItens(p.itens), '', `Subtotal: ${reais(p.subtotal)}`);
  if (p.taxa_entrega) linhas.push(`Entrega: ${reais(p.taxa_entrega)}`);
  if (p.desconto) linhas.push(`Desconto${p.cupom ? ` (${p.cupom})` : ''}: -${reais(p.desconto)}`);
  linhas.push(`*Total: ${reais(p.total)}*`, `Pagamento: ${p.pagamento}${p.troco_para ? ` · troco para ${reais(p.troco_para)}` : ''}`);
  if (p.obs) linhas.push(`Obs.: ${p.obs}`);
  if (linkAcompanhar) linhas.push('', `Acompanhe: ${linkAcompanhar}`);
  return linhas.join('\n');
}

// Mensagem que a loja manda para o cliente quando muda o status.
export function mensagemStatusCliente(loja, p) {
  const nome = p.cliente?.nome?.split(' ')[0] || '';
  const m = {
    preparo: `Olá ${nome}! Seu pedido #${p.numero} foi aceito e já está sendo preparado. 🍔`,
    pronto: p.tipo === 'retirada' ? `Olá ${nome}! Seu pedido #${p.numero} está pronto para retirada. 😋` : `Olá ${nome}! Seu pedido #${p.numero} está pronto.`,
    entrega: `Olá ${nome}! Seu pedido #${p.numero} saiu para entrega. 🛵`,
    concluido: `Pedido #${p.numero} concluído. Obrigado pela preferência, ${nome}! 💛`,
    cancelado: `Olá ${nome}, infelizmente seu pedido #${p.numero} foi cancelado. Fale com a gente se tiver dúvidas.`,
  };
  return `${m[p.status] || `Pedido #${p.numero}: ${STATUS[p.status]?.nome}`}\n— ${loja.nome}`;
}

export function linkWhatsApp(numero, texto) {
  let n = String(numero || '').replace(/\D/g, '');
  if (n && n.length <= 11) n = '55' + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

export function novoId(prefixo = 'id') {
  return `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
