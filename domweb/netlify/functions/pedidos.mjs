// DOM Web: cria pedidos do cardápio (recalculando os preços no servidor),
// consulta o andamento de um pedido e valida cupons.
//   POST /.netlify/functions/pedidos           corpo: dados do pedido
//   GET  /.netlify/functions/pedidos?id=<uuid> andamento do pedido
//   GET  /.netlify/functions/pedidos?cupom=X   valida cupom
import { calcularPedido } from '../../public/js/nucleo.js';
import { json, banco, carregarDados } from '../shared/servidor.mjs';

const CAMPOS_PUBLICOS = 'id,numero,criado_em,status,tipo,mesa,cliente,endereco,itens,subtotal,taxa_entrega,desconto,cupom,total,pagamento,troco_para,obs,historico';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const num = (p) => ({ ...p, subtotal: Number(p.subtotal), taxa_entrega: Number(p.taxa_entrega), desconto: Number(p.desconto), total: Number(p.total), troco_para: p.troco_para == null ? null : Number(p.troco_para) });

export default async (req) => {
  try {
    const url = new URL(req.url);

    if (req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (id) {
        if (!UUID.test(id)) return json({ erro: 'Pedido inválido' }, 400);
        const [p] = await banco(`/rest/v1/pedidos?id=eq.${id}&select=${CAMPOS_PUBLICOS}`);
        return p ? json({ pedido: num(p) }) : json({ erro: 'Pedido não encontrado' }, 404);
      }
      const codigo = (url.searchParams.get('cupom') || '').trim().toUpperCase();
      if (codigo) {
        const [c] = await banco(`/rest/v1/cupons?codigo=eq.${encodeURIComponent(codigo)}&ativo=eq.true&select=codigo,tipo,valor,minimo,ativo`);
        return c ? json({ cupom: { ...c, valor: Number(c.valor), minimo: Number(c.minimo) } }) : json({ erro: 'Cupom inválido' }, 404);
      }
      return json({ erro: 'Parâmetro ausente' }, 400);
    }

    if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405);
    const texto = await req.text();
    if (texto.length > 50_000) return json({ erro: 'Pedido muito grande' }, 413);
    const entrada = JSON.parse(texto);
    if (!Array.isArray(entrada.itens) || entrada.itens.length > 60) return json({ erro: 'Itens inválidos' }, 400);

    const dados = await carregarDados();
    const { erros, pedido } = calcularPedido(dados, entrada, { origem: 'cardapio' });
    if (erros.length) return json({ erro: erros.join('\n') }, 422);
    if (pedido.tipo === 'balcao') return json({ erro: 'Tipo de pedido inválido' }, 400);

    const agora = new Date().toISOString();
    const [novo] = await banco('/rest/v1/pedidos', {
      metodo: 'POST',
      corpo: { ...pedido, status: 'novo', origem: 'cardapio', historico: [{ status: 'novo', em: agora }] },
      headers: { Prefer: 'return=representation' },
    });
    return json({ pedido: num(novo) }, 201);
  } catch (e) {
    console.error(e);
    return json({ erro: 'Não foi possível processar o pedido agora. Tente novamente.' }, 500);
  }
};
