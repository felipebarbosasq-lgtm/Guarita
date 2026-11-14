// DOM Web: avisa o cliente pelo WhatsApp oficial quando o status do pedido muda.
// Chamado pelo painel (precisa estar logado).
//
// Regra da Meta: mensagem de texto livre só pode ser enviada até 24 h depois da última
// mensagem do cliente. Fora disso é preciso um "modelo" aprovado. Se você criar um modelo
// com 2 variáveis ({{1}} = nome, {{2}} = texto do status), coloque o nome dele em
// WHATSAPP_TEMPLATE_STATUS e ele será usado quando o texto livre não for aceito.
import { mensagemStatusCliente, STATUS } from '../../public/js/nucleo.js';
import { json, banco, usuarioDoToken, whatsappConfigurado, enviarTexto, enviarWhats, env } from '../shared/servidor.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405);
  if (!whatsappConfigurado()) return json({ erro: 'WhatsApp não configurado' }, 501);
  if (!(await usuarioDoToken(req))) return json({ erro: 'Não autorizado' }, 401);

  try {
    const { id } = await req.json();
    const [p] = await banco(`/rest/v1/pedidos?id=eq.${encodeURIComponent(id)}&select=*`);
    if (!p?.cliente?.telefone) return json({ erro: 'Pedido sem telefone' }, 404);
    const [linha] = await banco('/rest/v1/cardapio?id=eq.1&select=dados');
    const texto = mensagemStatusCliente(linha.dados.loja, p);
    try {
      await enviarTexto(p.cliente.telefone, texto);
    } catch (e) {
      const modelo = env('WHATSAPP_TEMPLATE_STATUS');
      if (!modelo) throw e;
      await enviarWhats(p.cliente.telefone, {
        type: 'template',
        template: {
          name: modelo,
          language: { code: 'pt_BR' },
          components: [{ type: 'body', parameters: [
            { type: 'text', text: p.cliente.nome.split(' ')[0] || 'cliente' },
            { type: 'text', text: `pedido #${p.numero}: ${STATUS[p.status]?.nome || p.status}` },
          ] }],
        },
      });
    }
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ erro: e.message }, 502);
  }
};
