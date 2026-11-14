/* Lê a página pública de compartilhamento do DWV (lp.dwvapp.com.br/<código>) e converte
   para os campos do cadastro de imóveis da Guarita. Não é uma API oficial do DWV: se a página
   mudar de formato, a importação avisa e o cadastro manual continua funcionando. */

export const PHOTO_BASE = 'https://dwvimages.s3.amazonaws.com';

/* aceita o link sozinho ou a mensagem inteira de compartilhamento */
export function findLink(text) {
  const m = String(text || '').match(/https?:\/\/lp\.dwvapp\.com\.br\/([0-9a-f]{32}|[0-9a-f-]{36})\b/i);
  return m ? `https://lp.dwvapp.com.br/${m[1].toLowerCase()}` : null;
}

export function extractNextData(html) {
  const m = String(html).match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('formato da página do DWV não reconhecido');
  return JSON.parse(m[1]);
}

const TIPOS = { APARTMENT: 'Apartamento', PENTHOUSE: 'Cobertura', HOUSE: 'Casa', CONDOMINIUM_HOUSE: 'Casa em condomínio', HOUSE_IN_CONDOMINIUM: 'Casa em condomínio',
  STUDIO: 'Studio', LOFT: 'Loft', FLAT: 'Flat', DUPLEX: 'Duplex', TRIPLEX: 'Triplex', GARDEN: 'Garden', COMMERCIAL_ROOM: 'Sala comercial', ROOM: 'Sala comercial',
  OFFICE: 'Sala comercial', STORE: 'Loja', SHOP: 'Loja', LAND: 'Terreno', LOT: 'Terreno', WAREHOUSE: 'Galpão' };
const STATUS = { AVAILABLE: 'disponivel', RESERVED: 'reservado', SOLD: 'vendido', RENTED: 'alugado' };
const CIDADES = { 'bal. camboriu': 'Balneário Camboriú', 'bal camboriu': 'Balneário Camboriú', 'balneario camboriu': 'Balneário Camboriú', 'itajai': 'Itajaí',
  'itapema': 'Itapema', 'porto belo': 'Porto Belo', 'camboriu': 'Camboriú', 'bombinhas': 'Bombinhas', 'navegantes': 'Navegantes', 'florianopolis': 'Florianópolis' };
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const num = v => (v === null || v === undefined || v === '' || Number(v) <= 0 ? null : Number(v));
const int = v => (num(v) === null ? null : Math.round(Number(v)));
const brl = v => 'R$ ' + new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const area = v => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v) + ' m²';
const titleCase = s => String(s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
const uniq = l => [...new Set(l.map(s => String(s).trim()).filter(Boolean))];

/* bairro: só existe no texto da mensagem ("Rua X 252, Centro Bal. Camboriú/SC") */
export function bairroFromText(text, rua, numero) {
  if (!text || !rua) return null;
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = String(text).match(new RegExp(esc(rua) + '\\s*,?\\s*' + (numero ? esc(numero) : '\\d*') + '\\s*,\\s*([^\\n,/]+?)\\s+(Bal\\.|Balne|Itaja|Itapema|Porto Belo|Cambori|Bombinhas|Navegantes|Florian)', 'i'));
  return m ? titleCase(m[1]).trim() : null;
}

export function normalize(next, text = '') {
  const d = next && next.props && next.props.pageProps && next.props.pageProps.data;
  const p = d && d.property;
  if (!p || !p.name) throw new Error('a página não trouxe os dados do imóvel (link expirado ou inválido?)');
  const a = p.address || {}, city = (a.city && a.city.name) || '';
  const rent = !!p.isRent;
  const unit = [], dev = [];
  (p.features || []).forEach(f => (f.type === 'PROPERTY' ? unit : dev).push(f.title));
  (p.additionalItems || []).forEach(g => ((/unidade/i.test(g.titulo || '') ? unit : dev).push(...(g.items || []).map(i => i.item))));
  const tipo = TIPOS[p.category] || (p.category ? titleCase(String(p.category).replace(/_/g, ' ')) : 'Apartamento');
  const cidade = CIDADES[fold(city)] || city;
  const endereco = [a.streetName, a.number].filter(Boolean).join(', ');
  const valor = rent ? num(p.rentalPrice) : num(p.price);
  const im = {
    nome: String(p.name).trim(),
    complemento: p.nameComposition ? String(p.nameComposition).trim() : (a.complement || null),
    tipo, finalidade: rent ? 'locacao' : 'venda', status: STATUS[p.status] || 'disponivel',
    endereco: endereco || null,
    bairro: a.neighborhoodName ? titleCase(a.neighborhoodName) : bairroFromText(text, a.streetName, a.number),
    cidade, estado: (a.city && a.city.uf) || 'SC',
    valor, area_privativa: num(p.privateArea), area_total: num(p.totalArea),
    dormitorios: int(p.bedrooms), suites: int(p.suites), banheiros: int(p.bathrooms), vagas: int(p.garages),
    caracteristicas: uniq([...unit, ...dev]),
  };
  /* descrição montada só com os dados do anúncio (o DWV não tem texto corrido) */
  const partes = [];
  if (im.area_privativa) partes.push(`${area(im.area_privativa)} privativos`);
  if (im.dormitorios) partes.push(`${im.dormitorios} ${im.dormitorios === 1 ? 'dormitório' : 'dormitórios'}${im.suites ? ` (${im.suites === im.dormitorios ? (im.suites === 1 ? 'sendo suíte' : 'todos suítes') : `${im.suites} ${im.suites === 1 ? 'suíte' : 'suítes'}`})` : ''}`);
  if (im.banheiros) partes.push(`${im.banheiros} ${im.banheiros === 1 ? 'banheiro' : 'banheiros'}`);
  if (im.vagas) partes.push(`${im.vagas} ${im.vagas === 1 ? 'vaga de garagem' : 'vagas de garagem'}`);
  const ond = im.bairro ? `no bairro ${im.bairro}, em ${im.cidade}` : (im.cidade ? `em ${im.cidade}` : '');
  const juntar = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1] : l.join('');
  im.descricao = [
    `${tipo} no ${im.nome}${ond ? ', ' + ond : ''}${partes.length ? ', com ' + juntar(partes) : ''}.`,
    unit.length ? `Na unidade: ${juntar(uniq(unit).map(s => s.toLowerCase()))}.` : '',
    dev.length ? `No empreendimento: ${juntar(uniq(dev).map(s => s.toLowerCase()))}.` : '',
  ].filter(Boolean).join('\n\n');
  const info = [];
  if (num(p.administrationFee)) info.push(`Condomínio: ${brl(num(p.administrationFee))} por mês.`);
  if (num(p.propertyTax)) info.push(`IPTU: ${brl(num(p.propertyTax))}.`);
  if (p.deliveryDate) info.push(`Previsão de entrega: ${String(p.deliveryDate).slice(0, 10).split('-').reverse().join('/')}.`);
  if (p.reDeveloper && p.reDeveloper.name) info.push(`Construtora: ${p.reDeveloper.name}.`);
  im.info_complementar = info.join('\n');
  /* fotos: capa primeiro, sem repetições */
  const paths = uniq([p.coverPath, ...((p.files && p.files.pictures) || []).map(x => (typeof x === 'string' ? x : x && (x.path || x.url)))])
    .filter(x => /^\/images\/properties\//.test(x) || /^https:\/\/dwvimages\./.test(x));
  const seen = new Set(), fotos = [];
  for (const x of paths) {
    const u = (x.startsWith('http') ? x : PHOTO_BASE + x).replace(/\?.*$/, ''), nome = u.split('/').pop();
    if (!seen.has(nome)) { seen.add(nome); fotos.push(u); } // a capa também aparece na galeria
  }
  return { imovel: im, fotos, origem: { id: p.id, codigoDwv: p.legacyId || null, construtora: (p.reDeveloper && p.reDeveloper.name) || null } };
}
