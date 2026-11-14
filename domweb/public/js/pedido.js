// DOM Web: acompanhamento do pedido pelo cliente.
import { carregarCardapio, consultarPedido } from './dados.js';
import { STATUS, TIPOS, reais, mensagemPedidoWhatsApp, linkWhatsApp, textoEndereco } from './nucleo.js';
import { $, esc, hora } from './ui.js';

const params = new URLSearchParams(location.search);
const id = params.get('id');
let D;

async function pintar() {
  const p = await consultarPedido(id);
  if (!p) {
    $('#conteudo').innerHTML = `<div class="cartao"><p class="vazio">Pedido não encontrado.</p><a class="btn btn-amarelo btn-bloco" href="/">Voltar ao cardápio</a></div>`;
    return;
  }
  const L = D.loja;
  const etapas = p.tipo === 'entrega' ? ['novo', 'preparo', 'entrega', 'concluido'] : ['novo', 'preparo', 'pronto', 'concluido'];
  const quando = Object.fromEntries((p.historico || []).map((h) => [h.status, h.em]));
  const idxAtual = etapas.indexOf(p.status);
  const subt = {
    novo: 'Aguardando a loja aceitar seu pedido.',
    preparo: 'Seu pedido está sendo preparado.',
    pronto: p.tipo === 'retirada' ? 'Pode vir buscar!' : 'Pedido pronto.',
    entrega: 'O entregador está a caminho.',
    concluido: 'Bom apetite! Obrigado pela preferência.',
    cancelado: 'Este pedido foi cancelado. Fale com a loja pelo WhatsApp.',
  }[p.status];
  const link = `${location.origin}/pedido.html?id=${encodeURIComponent(p.id)}`;
  const whats = L.whatsapp ? linkWhatsApp(L.whatsapp, mensagemPedidoWhatsApp(L, p, link)) : '';

  $('#conteudo').innerHTML = `
    <section class="cartao">
      <div class="num">Pedido #${p.numero} · ${TIPOS[p.tipo]}${p.mesa ? ` ${esc(p.mesa)}` : ''}</div>
      <div class="estado" style="color:${p.status === 'cancelado' ? 'var(--vermelho)' : 'var(--preto)'}">${p.status === 'novo' ? 'Pedido recebido' : STATUS[p.status].nome}</div>
      <p class="sub">${subt}</p>
      ${
        p.status === 'cancelado'
          ? ''
          : `<ol class="linha-tempo">${etapas
              .map((e, i) => `<li class="${i <= idxAtual ? 'feito' : ''}">${STATUS[e].nome}${quando[e] ? `<small>${hora(quando[e])}</small>` : ''}</li>`)
              .join('')}</ol>`
      }
      ${
        whats && params.get('novo')
          ? `<div class="destaque-whats"><strong>Último passo: confirme no WhatsApp</strong>Toque no botão abaixo para enviar o pedido para a loja pelo WhatsApp. Assim eles recebem na hora.</div>`
          : ''
      }
      <div class="acoes">
        ${whats ? `<a class="btn btn-whats btn-bloco" href="${whats}" target="_blank" rel="noopener">💬 ${params.get('novo') ? 'Enviar pedido no WhatsApp' : 'Falar com a loja no WhatsApp'}</a>` : ''}
        <a class="btn btn-borda btn-bloco" href="/">Voltar ao cardápio</a>
      </div>
    </section>
    <section class="cartao">
      <h2 style="font-size:16px;font-weight:900;margin-bottom:8px">Resumo</h2>
      <div class="itens">${p.itens
        .map(
          (i) => `<div><span>${i.qtd}x ${esc(i.nome)}${i.adicionais.map((a) => `<small>+ ${esc(a.nome)}</small>`).join('')}${i.obs ? `<small>Obs.: ${esc(i.obs)}</small>` : ''}</span><strong>${reais(i.total)}</strong></div>`,
        )
        .join('')}
        ${p.taxa_entrega ? `<div><span>Entrega</span><span>${reais(p.taxa_entrega)}</span></div>` : ''}
        ${p.desconto ? `<div><span>Desconto</span><span>− ${reais(p.desconto)}</span></div>` : ''}
      </div>
      <div class="tot"><span>Total</span><span>${reais(p.total)}</span></div>
      <p class="sub" style="margin-top:10px">Pagamento: ${esc(p.pagamento)}${p.troco_para ? ` · troco para ${reais(p.troco_para)}` : ''}</p>
      ${p.endereco ? `<p class="sub">Entrega em: ${esc(textoEndereco(p.endereco))}</p>` : ''}
    </section>`;
}

(async () => {
  D = await carregarCardapio();
  document.title = `Pedido · ${D.loja.nome}`;
  $('#loja').textContent = D.loja.nome;
  if (D.loja.logo) $('#logo').src = D.loja.logo;
  await pintar();
  setInterval(pintar, 10_000);
})();
