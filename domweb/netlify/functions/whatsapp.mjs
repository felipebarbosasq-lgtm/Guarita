// DOM Web: atendente de WhatsApp com IA (Claude) usando a API oficial da Meta.
// Configure na Meta o webhook: https://SEU-SITE/.netlify/functions/whatsapp
// com o mesmo WHATSAPP_VERIFY_TOKEN e assine o campo "messages".
import Anthropic from '@anthropic-ai/sdk';
import { situacaoLoja, reais, precoProduto, DIAS_SEMANA, STATUS, TIPOS, textoItens } from '../../public/js/nucleo.js';
import { json, banco, env, enviarTexto, whatsappConfigurado } from '../shared/servidor.mjs';

const MODELO = env('CLAUDE_MODEL') || 'claude-haiku-5-5';
const MAX_HISTORICO = 16;

export default async (req) => {
  const url = new URL(req.url);

  // Verificação do webhook pela Meta
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env('WHATSAPP_VERIFY_TOKEN') && env('WHATSAPP_VERIFY_TOKEN');
    return ok ? new Response(url.searchParams.get('hub.challenge')) : new Response('Proibido', { status: 403 });
  }
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405);
  if (!whatsappConfigurado()) return json({ ok: false, motivo: 'WhatsApp não configurado' });

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return json({ ok: true });
  }

  const mensagens = [];
  for (const entry of corpo.entry || []) {
    for (const ch of entry.changes || []) {
      const v = ch.value || {};
      const nomes = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of v.messages || []) mensagens.push({ ...m, nome: nomes[m.from] });
    }
  }

  for (const m of mensagens) {
    try {
      await responder(m, url.origin);
    } catch (e) {
      console.error('Erro ao responder', m.from, e);
    }
  }
  // Sempre 200 para a Meta não reenviar a mesma mensagem.
  return json({ ok: true });
};

async function responder(m, origem) {
  const tel = m.from;
  const [conversa] = await banco(`/rest/v1/conversas?telefone=eq.${tel}&select=*`);
  if (conversa?.ultimo_id === m.id) return; // mensagem repetida

  const texto =
    m.type === 'text' ? m.text?.body :
    m.type === 'interactive' ? m.interactive?.button_reply?.title || m.interactive?.list_reply?.title :
    m.type === 'button' ? m.button?.text : null;

  const [linha] = await banco('/rest/v1/cardapio?id=eq.1&select=dados');
  const dados = linha.dados;
  const link = env('SITE_URL') || origem;

  if (!texto) {
    await enviarTexto(tel, `Recebi sua mensagem! Por aqui eu entendo melhor texto 🙂\nPara pedir, acesse: ${link}`);
    return;
  }

  const historico = [...(conversa?.mensagens || []), { role: 'user', content: texto.slice(0, 1500) }].slice(-MAX_HISTORICO);
  while (historico.length && historico[0].role !== 'user') historico.shift();

  let resposta;
  if (!env('ANTHROPIC_API_KEY')) {
    resposta = `Olá${m.nome ? ', ' + m.nome.split(' ')[0] : ''}! 👋 Bem-vindo(a) à ${dados.loja.nome}.\nVeja o cardápio e faça seu pedido aqui: ${link}`;
  } else {
    const ultimoPedido = await pedidoRecente(tel);
    const client = new Anthropic();
    const r = await client.messages.create({
      model: MODELO,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: promptFixo(dados, link), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: contextoAgora(dados, ultimoPedido, m.nome) },
      ],
      messages: historico,
    });
    if (r.stop_reason === 'refusal') {
      resposta = `Não consegui ajudar com isso por aqui. Para pedidos, acesse ${link} ou aguarde que um atendente responde. 🙂`;
    } else {
      resposta = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim() || `Acesse nosso cardápio: ${link}`;
    }
  }

  await enviarTexto(tel, resposta);
  historico.push({ role: 'assistant', content: resposta });
  await banco('/rest/v1/conversas', {
    metodo: 'POST',
    corpo: { telefone: tel, nome: m.nome || conversa?.nome || null, mensagens: historico.slice(-MAX_HISTORICO), ultimo_id: m.id, atualizado_em: new Date().toISOString() },
    headers: { Prefer: 'resolution=merge-duplicates' },
  });
}

// Pedido mais recente do cliente (casando pelos 8 últimos dígitos, por causa do 9º dígito).
async function pedidoRecente(tel) {
  const fim = String(tel).replace(/\D/g, '').slice(-8);
  const desde = new Date(Date.now() - 2 * 86400000).toISOString();
  const lista = await banco(`/rest/v1/pedidos?select=numero,status,tipo,total,itens,criado_em,cliente&cliente->>telefone=like.*${fim}&criado_em=gte.${desde}&order=criado_em.desc&limit=1`);
  return lista[0] || null;
}

// Parte fixa do prompt (cardápio e regras): fica em cache para economizar.
function promptFixo(dados, link) {
  const L = dados.loja;
  const cats = [...dados.categorias].filter((c) => c.ativo).sort((a, b) => a.posicao - b.posicao);
  const cardapio = cats
    .map((c) => {
      const prods = dados.produtos.filter((p) => p.categoria_id === c.id && p.ativo);
      if (!prods.length) return '';
      return `## ${c.nome}\n` + prods.map((p) => {
        let s = `- ${p.nome}: ${reais(precoProduto(p))}${p.descricao ? ` — ${p.descricao}` : ''}`;
        for (const g of p.grupos || []) s += `\n  · ${g.nome}: ${g.itens.filter((o) => o.ativo).map((o) => `${o.nome}${o.preco ? ` (+${reais(o.preco)})` : ''}`).join(', ')}`;
        return s;
      }).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
  const horarios = DIAS_SEMANA.map((d, i) => `${d}: ${(L.horarios?.[i] || []).map((f) => `${f.de}–${f.ate}`).join(', ') || 'fechado'}`).join('\n');
  const bairros = (dados.bairros || []).filter((b) => b.ativo).map((b) => `${b.nome}: ${b.taxa ? reais(b.taxa) : 'grátis'}`).join('; ');
  const end = [L.endereco?.rua && `${L.endereco.rua}, ${L.endereco.numero}`, L.endereco?.complemento, L.endereco?.bairro, L.endereco?.cidade].filter(Boolean).join(', ');

  return `Você é o atendente virtual da ${L.nome}, respondendo clientes pelo WhatsApp.

Como responder:
- Português do Brasil, simpático e direto, frases curtas, no máximo 2 ou 3 emojis. Nada de markdown com # ou tabelas; pode usar *negrito* do WhatsApp.
- Para fazer o pedido, sempre envie o link do cardápio: ${link}
  (lá o cliente escolhe os itens, adicionais, endereço e pagamento, e acompanha o pedido).
- Use somente as informações abaixo. Se não souber (ex.: ingrediente não listado, alergias, reclamações, reembolsos), diga que vai chamar um atendente humano e que ele responde em breve.
- Nunca invente produtos, preços, promoções ou prazos. Não confirme pedidos feitos por mensagem: oriente a usar o link.
- Se o cliente perguntar pelo pedido dele, use o "Pedido recente" informado no contexto.

Loja: ${L.nome}
Endereço: ${end || 'não informado'}
Telefone: ${L.telefone || ''}
Atende: ${[L.aceita_entrega && 'entrega', L.aceita_retirada && 'retirada no local', L.aceita_mesa && 'consumo no local'].filter(Boolean).join(', ')}
Pedido mínimo: ${L.pedido_minimo ? reais(L.pedido_minimo) : 'não há'}
Tempo médio: entrega ${L.tempo_entrega || '-'}, retirada ${L.tempo_retirada || '-'}
Taxas de entrega por bairro: ${bairros || 'consultar'}${L.entrega_gratis_acima ? ` (grátis acima de ${reais(L.entrega_gratis_acima)})` : ''}
Pagamento: ${(L.pagamentos || []).map((p) => p.nome).join(', ')}${L.chave_pix ? ` · Chave Pix: ${L.chave_pix}` : ''}

Horários:
${horarios}

Cardápio:
${cardapio}`;
}

// Parte que muda a cada mensagem (fora do cache).
function contextoAgora(dados, pedido, nome) {
  const s = situacaoLoja(dados.loja);
  let t = `Agora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Situação da loja: ${s.motivo}.`;
  if (nome) t += `\nNome do cliente no WhatsApp: ${nome}.`;
  if (pedido) {
    t += `\nPedido recente deste cliente: #${pedido.numero} (${TIPOS[pedido.tipo]}), status "${STATUS[pedido.status]?.nome}", total ${reais(pedido.total)}, feito em ${new Date(pedido.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.\nItens:\n${textoItens(pedido.itens)}`;
  } else {
    t += '\nEste cliente não tem pedido nos últimos 2 dias.';
  }
  return t;
}
