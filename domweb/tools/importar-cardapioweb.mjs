// Importa o cardápio de uma loja sua cadastrada na Cardápio Web para o DOM Web.
//
// Uso:
//   node tools/importar-cardapioweb.mjs <slug-da-loja>
//     ex.: node tools/importar-cardapioweb.mjs dom_pappiro
//   node tools/importar-cardapioweb.mjs --arquivos perfil.json categorias.json
//
// Gera public/data/loja-inicial.json e baixa as fotos para public/img/produtos/.
// Depois rode: python3 tools/otimizar_imagens.py  (reduz o tamanho das fotos)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://integracao.cardapioweb.com/api/menu/company';

async function baixarJson(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...headers } });
  if (!r.ok) throw new Error(`Falha ${r.status} em ${url}`);
  return r.json();
}

async function carregar() {
  const args = process.argv.slice(2);
  if (args[0] === '--arquivos') {
    const perfil = JSON.parse(await fs.readFile(args[1], 'utf8'));
    const categorias = JSON.parse(await fs.readFile(args[2], 'utf8'));
    return { perfil, categorias };
  }
  const slug = args[0];
  if (!slug) throw new Error('Informe o endereço da loja, ex.: dom_pappiro');
  const perfil = await baixarJson(`${API}/profile?company=${encodeURIComponent(slug)}&hostname=app.cardapioweb.com`);
  const categorias = await baixarJson(`${API}/categories?only_available_for=delivery&origin=catalogo`, {
    'Company-ID': String(perfil.id),
  });
  return { perfil, categorias };
}

const DIAS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function tipoPagamento(kind = '', nome = '') {
  const n = nome.toLowerCase();
  if (kind === 'money' || n.includes('dinheiro')) return 'dinheiro';
  if (n.includes('pix')) return 'pix';
  if (n.includes('crédito') || n.includes('credito')) return 'credito';
  if (n.includes('débito') || n.includes('debito')) return 'debito';
  return 'outro';
}

async function baixarImagem(url, destino) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return false;
    await fs.writeFile(destino, Buffer.from(await r.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { perfil, categorias } = await carregar();
  const dirImg = path.join(raiz, 'public/img/produtos');
  await fs.mkdir(dirImg, { recursive: true });

  let nCat = 0;
  let nPrd = 0;
  let nGrp = 0;
  let nOpc = 0;
  const cats = [];
  const produtos = [];

  for (const cat of categorias) {
    if (!cat.items?.length) continue;
    const catId = `cat${++nCat}`;
    cats.push({ id: catId, nome: cat.name.trim(), posicao: nCat, ativo: cat.status === 'ACTIVE' });
    for (const it of cat.items) {
      const id = `prd${++nPrd}`;
      let imagem = '';
      if (it.image_url) {
        const nome = `${id}.jpg`; // o otimizador converte tudo para JPEG
        if (await baixarImagem(it.image_url, path.join(dirImg, nome))) imagem = `/img/produtos/${nome}`;
      }
      produtos.push({
        id,
        categoria_id: catId,
        nome: it.name.trim(),
        descricao: (it.description || '').trim(),
        preco: Number(it.price) || 0,
        preco_promocional: it.promotional_price_active && it.promotional_price ? Number(it.promotional_price) : null,
        imagem,
        ativo: it.status === 'ACTIVE',
        destaque: !!it.highlighted,
        posicao: nPrd,
        grupos: (it.add_ons || []).map((g) => ({
          id: `grp${++nGrp}`,
          nome: g.name.trim(),
          min: g.minimum_quantity || 0,
          max: g.maximum_quantity || 1,
          itens: (g.subitems || []).map((s) => ({
            id: `opc${++nOpc}`,
            nome: s.name.trim(),
            preco: Number(s.price) || 0,
            ativo: s.status === 'ACTIVE',
          })),
        })),
      });
    }
  }

  const horarios = {};
  DIAS.forEach((d, i) => {
    horarios[i] = (perfil.business_hours?.[d] || []).map(([de, ate]) => ({ de, ate }));
  });

  const loja = {
    nome: perfil.name,
    descricao: (perfil.description || '').trim(),
    telefone: perfil.phone_number || '',
    whatsapp: perfil.order_whatsapp || '',
    instagram: perfil.instagram || '',
    endereco: {
      rua: perfil.street || '',
      numero: perfil.address_number || '',
      complemento: perfil.address_complement || '',
      bairro: perfil.neighborhood || '',
      cidade: perfil.city || '',
      uf: perfil.state || '',
    },
    logo: '/img/logo.jpg',
    capa: '/img/capa.jpg',
    horarios,
    status_manual: 'auto',
    pedido_minimo: Number(perfil.minimum_order_value) || 0,
    tempo_entrega: '40-60 min',
    tempo_retirada: '20-30 min',
    aceita_entrega: perfil.flags?.work_with_delivery !== false,
    aceita_retirada: perfil.flags?.work_with_pick_up_store !== false,
    aceita_mesa: perfil.flags?.work_with_onsite !== false,
    referencia_obrigatoria: !!perfil.flags?.address_landmark_required,
    entrega_gratis_acima: perfil.free_delivery_from ? Number(perfil.free_delivery_from) : null,
    pagamentos: (perfil.payment_methods || [])
      .filter((p) => p.available_on_menu !== false)
      .map((p) => ({ nome: p.name, tipo: tipoPagamento(p.kind, p.name) })),
    chave_pix: '',
    fidelidade: { ativo: !!perfil.loyalty_program_setting, pontos_por_real: perfil.loyalty_program_setting?.points_per_currency_unit || 1 },
  };

  if (perfil.logo) await baixarImagem(perfil.logo, path.join(raiz, 'public/img/logo.jpg'));
  if (perfil.image) await baixarImagem(perfil.image, path.join(raiz, 'public/img/capa.jpg'));

  // Taxas de entrega: a Cardápio Web calcula por distância e não publica a tabela.
  // Deixamos um bairro de exemplo para você ajustar no painel (Entrega > Bairros).
  const bairros = [{ id: 'bai1', nome: loja.endereco.bairro ? loja.endereco.bairro[0].toUpperCase() + loja.endereco.bairro.slice(1) : 'Centro', taxa: 3, ativo: true }];

  const dados = { versao: 1, loja, bairros, categorias: cats, produtos, cupons: [] };
  await fs.writeFile(path.join(raiz, 'public/data/loja-inicial.json'), JSON.stringify(dados, null, 2));
  console.log(`Importado: ${cats.length} categorias, ${produtos.length} produtos, ${produtos.filter((p) => p.imagem).length} fotos.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
