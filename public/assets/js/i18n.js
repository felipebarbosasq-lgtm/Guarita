/* Guarita Imobiliária: idiomas do site (Português, English, Español).
   Traduz os textos fixos das páginas e as frases montadas pelo site (cartões, busca, página do imóvel).
   Os dados cadastrados no painel (nome, descrição, bairro…) aparecem como foram escritos.
   As mensagens enviadas ao WhatsApp da Guarita continuam em português.
   Para incluir ou corrigir uma tradução: acrescente "texto em português": ['English', 'Español'] em D. */
(function () {
'use strict';
const LANGS = ['pt', 'en', 'es'];
let lang = (new URLSearchParams(location.search).get('lang') || '').slice(0, 2);
if (!LANGS.includes(lang)) { try { lang = localStorage.getItem('guarita-lang') || ''; } catch (_) { lang = ''; } }
if (!LANGS.includes(lang)) lang = 'pt';

const D = {
  // topo, menu e geral
  'Imóveis': ['Properties', 'Inmuebles'], 'Regiões': ['Regions', 'Regiones'], 'A Guarita': ['About us', 'Nosotros'],
  'Atendimento': ['Contact us', 'Atención'], 'Contato': ['Contact', 'Contacto'], 'Falar no WhatsApp': ['Chat on WhatsApp', 'Hablar por WhatsApp'],
  'Buscar imóveis': ['Search properties', 'Buscar inmuebles'], 'Buscar': ['Search', 'Buscar'], 'Idioma': ['Language', 'Idioma'],
  'Praia, bairro, empreendimento…': ['Beach, neighborhood, building…', 'Playa, barrio, edificio…'],
  'Abrir menu': ['Open menu', 'Abrir menú'], 'Fechar menu': ['Close menu', 'Cerrar menú'], 'Principal': ['Main', 'Principal'],
  'Pular para o conteúdo': ['Skip to content', 'Saltar al contenido'], 'Guarita Imobiliária, voltar ao início': ['Guarita Imobiliária, back to top', 'Guarita Imobiliária, volver al inicio'],
  'Conversar no WhatsApp': ['Chat on WhatsApp', 'Conversar por WhatsApp'],
  // abertura
  'A imobiliária da sua família.': ['The real estate agency for your family.', 'La inmobiliaria de su familia.'],
  'Ver imóveis': ['View properties', 'Ver inmuebles'], 'Falar com um especialista': ['Talk to a specialist', 'Hablar con un especialista'],
  'Imobiliária': ['Real Estate', 'Inmobiliaria'],
  'Guarita Imobiliária | A imobiliária da sua família': ['Guarita Imobiliária | The real estate agency for your family', 'Guarita Imobiliária | La inmobiliaria de su familia'],
  // imóveis e busca
  'Encontre seu próximo imóvel': ['Find your next property', 'Encuentre su próximo inmueble'],
  'Explore oportunidades para morar, investir ou alugar.': ['Explore opportunities to live, invest or rent.', 'Descubra oportunidades para vivir, invertir o alquilar.'],
  'Todos': ['All', 'Todos'], 'Comprar': ['Buy', 'Comprar'], 'Alugar': ['Rent', 'Alquilar'], 'Região': ['Region', 'Región'], 'Finalidade': ['Purpose', 'Finalidad'],
  'Todas as regiões': ['All regions', 'Todas las regiones'], 'Flórida (EUA)': ['Florida (USA)', 'Florida (EE. UU.)'],
  'Imóveis em destaque': ['Featured properties', 'Inmuebles destacados'], 'Imóvel anterior': ['Previous property', 'Inmueble anterior'], 'Próximo imóvel': ['Next property', 'Siguiente inmueble'],
  'Pausar': ['Pause', 'Pausar'], 'Retomar': ['Resume', 'Reanudar'],
  'Os imóveis não puderam ser carregados agora.': ['Properties could not be loaded right now.', 'No fue posible cargar los inmuebles ahora.'],
  'Ver imóvel': ['View property', 'Ver inmueble'], 'Valor': ['Price', 'Precio'], 'Aluguel': ['Rent', 'Alquiler'], 'Sob consulta': ['Price on request', 'Precio a consultar'],
  'De': ['From', 'De'], 'Por': ['Now', 'Por'], 'Oportunidade': ['Opportunity', 'Oportunidad'], 'Reservado': ['Reserved', 'Reservado'], 'Vendido': ['Sold', 'Vendido'], 'Alugado': ['Rented', 'Alquilado'],
  'Características': ['Features', 'Características'], 'privativos': ['private area', 'privados'],
  'dormitório': ['bedroom', 'dormitorio'], 'dormitórios': ['bedrooms', 'dormitorios'], 'suíte': ['suite', 'suite'], 'suítes': ['suites', 'suites'], 'vaga': ['parking space', 'cochera'], 'vagas': ['parking spaces', 'cocheras'],
  '{n} fotos': ['{n} photos', '{n} fotos'], 'Ver todos': ['View all', 'Ver todos'], 'Ver todos os imóveis': ['View all properties', 'Ver todos los inmuebles'],
  '{n} imóvel encontrado': ['{n} property found', '{n} inmueble encontrado'], '{n} imóveis encontrados': ['{n} properties found', '{n} inmuebles encontrados'],
  'à venda': ['for sale', 'en venta'], 'para alugar': ['for rent', 'en alquiler'], 'em {r}': ['in {r}', 'en {r}'], 'para “{q}”': ['for “{q}”', 'para “{q}”'],
  'Ainda não temos imóveis {o} publicados no site, mas a Guarita pode encontrar para você.': ['We don’t have properties {o} listed yet, but Guarita can find one for you.', 'Aún no tenemos inmuebles {o} publicados, pero Guarita puede encontrarlo para usted.'],
  // tipos
  'Apartamento': ['Apartment', 'Departamento'], 'Cobertura': ['Penthouse', 'Penthouse'], 'Casa': ['House', 'Casa'], 'Casa em condomínio': ['Gated community house', 'Casa en condominio'],
  'Sala comercial': ['Office', 'Oficina'], 'Loja': ['Store', 'Local comercial'], 'Terreno': ['Land', 'Terreno'], 'Studio': ['Studio', 'Estudio'], 'Outro': ['Other', 'Otro'],
  // regiões
  'Áreas de atuação': ['Where we work', 'Dónde actuamos'], 'Sua próxima conquista começa aqui': ['Your next achievement starts here', 'Su próxima conquista empieza aquí'],
  'Encontre seu imóvel em destinos especiais do litoral catarinense e na Flórida, nos Estados Unidos.': ['Find your property in special destinations on the Santa Catarina coast and in Florida, USA.', 'Encuentre su inmueble en destinos especiales del litoral de Santa Catarina y en Florida, Estados Unidos.'],
  'Santa Catarina': ['Santa Catarina, Brazil', 'Santa Catarina, Brasil'], 'Itajaí · Santa Catarina': ['Itajaí · Santa Catarina, Brazil', 'Itajaí · Santa Catarina, Brasil'],
  'Flórida': ['Florida', 'Florida'], 'Estados Unidos': ['United States', 'Estados Unidos'], 'Falar sobre esta região →': ['Ask about this region →', 'Consultar sobre esta región →'],
  'Regiões de atuação': ['Regions where we work', 'Regiones donde actuamos'], 'Região anterior': ['Previous region', 'Región anterior'], 'Próxima região': ['Next region', 'Próxima región'],
  'Balneário Camboriú: falar com a Guarita sobre imóveis na região': ['Balneário Camboriú: ask Guarita about properties in the region', 'Balneário Camboriú: consultar a Guarita sobre inmuebles en la región'],
  'Porto Belo: falar com a Guarita sobre imóveis na região': ['Porto Belo: ask Guarita about properties in the region', 'Porto Belo: consultar a Guarita sobre inmuebles en la región'],
  'Itapema: falar com a Guarita sobre imóveis na região': ['Itapema: ask Guarita about properties in the region', 'Itapema: consultar a Guarita sobre inmuebles en la región'],
  'Praia Brava, em Itajaí: falar com a Guarita sobre imóveis na região': ['Praia Brava, Itajaí: ask Guarita about properties in the region', 'Praia Brava, Itajaí: consultar a Guarita sobre inmuebles en la región'],
  'Flórida, Estados Unidos: falar com a Guarita sobre imóveis na região': ['Florida, USA: ask Guarita about properties in the region', 'Florida, EE. UU.: consultar a Guarita sobre inmuebles en la región'],
  'Roda-gigante e orla de Balneário Camboriú': ['Ferris wheel and waterfront in Balneário Camboriú', 'Noria y costanera de Balneário Camboriú'],
  'Barcos ancorados na baía de Porto Belo ao entardecer': ['Boats anchored in Porto Belo bay at sunset', 'Barcos anclados en la bahía de Porto Belo al atardecer'],
  'Edifícios à beira-mar na praia de Itapema': ['Beachfront buildings in Itapema', 'Edificios frente al mar en la playa de Itapema'],
  'Vista da Praia Brava, em Itajaí, ao entardecer': ['Praia Brava, Itajaí, at sunset', 'Praia Brava, Itajaí, al atardecer'],
  'Skyline de Miami, na Flórida, à beira da baía de Biscayne': ['Miami skyline, Florida, on Biscayne Bay', 'Skyline de Miami, Florida, junto a la bahía de Biscayne'],
  // institucional
  'Fundador da Guarita': ['Founder of Guarita', 'Fundador de Guarita'],
  'Com mais de 22 anos de experiência no mercado imobiliário, construiu uma trajetória pautada por credibilidade, exclusividade e excelência.': ['With more than 22 years of experience in the real estate market, he has built a career based on credibility, exclusivity and excellence.', 'Con más de 22 años de experiencia en el mercado inmobiliario, construyó una trayectoria basada en credibilidad, exclusividad y excelencia.'],
  'Especialista em imóveis de alto padrão, Jeferson representa mais do que propriedades: representa um estilo de vida.': ['A specialist in luxury real estate, Jeferson represents more than properties: he represents a lifestyle.', 'Especialista en inmuebles de alto nivel, Jeferson representa más que propiedades: representa un estilo de vida.'],
  'Mais de 22 anos de experiência': ['More than 22 years of experience', 'Más de 22 años de experiencia'], 'Trajetória do fundador no mercado imobiliário.': ['The founder’s career in real estate.', 'Trayectoria del fundador en el mercado inmobiliario.'],
  'Atendimento personalizado': ['Personalized service', 'Atención personalizada'], 'Você conversa diretamente com um especialista da Guarita.': ['You talk directly to a Guarita specialist.', 'Usted conversa directamente con un especialista de Guarita.'],
  'Comprar, investir, alugar e administrar': ['Buy, invest, rent and manage', 'Comprar, invertir, alquilar y administrar'],
  'Imóveis na planta e prontos, locação e administração para proprietários.': ['Off-plan and ready properties, rentals and property management for owners.', 'Inmuebles en pozo y terminados, alquileres y administración para propietarios.'],
  'Escritório em Balneário Camboriú': ['Office in Balneário Camboriú', 'Oficina en Balneário Camboriú'],
  'Jeferson Monteiro, fundador da Guarita Imobiliária, em seu escritório': ['Jeferson Monteiro, founder of Guarita Imobiliária, in his office', 'Jeferson Monteiro, fundador de Guarita Imobiliária, en su oficina'],
  // atendimento
  'Como podemos ajudar?': ['How can we help?', '¿Cómo podemos ayudarle?'], 'Escolha uma opção e fale com um especialista da Guarita.': ['Choose an option and talk to a Guarita specialist.', 'Elija una opción y hable con un especialista de Guarita.'],
  'Tipo de atendimento': ['Type of service', 'Tipo de atención'], 'Anunciar meu imóvel': ['List my property', 'Publicar mi inmueble'],
  'Encontre o imóvel ideal para você.': ['Find the ideal property for you.', 'Encuentre el inmueble ideal para usted.'],
  'Conte o que você procura e receba um atendimento personalizado.': ['Tell us what you are looking for and get personalized service.', 'Cuéntenos qué busca y reciba una atención personalizada.'],
  'Nome': ['Name', 'Nombre'], 'WhatsApp com DDD': ['WhatsApp with area code', 'WhatsApp con código de área'], 'Região de interesse': ['Region of interest', 'Región de interés'],
  'Faixa de valor': ['Price range', 'Rango de precio'], 'Selecione': ['Select', 'Seleccione'], 'Ainda não decidi': ['Not decided yet', 'Aún no lo decidí'], 'Prefiro conversar': ['I prefer to talk', 'Prefiero conversar'],
  'A partir de R$ 6,5 milhões': ['From R$ 6.5 million', 'Desde R$ 6,5 millones'], 'R$ 1 a 2 milhões': ['R$ 1 to 2 million', 'R$ 1 a 2 millones'], 'R$ 2,5 a 3,5 milhões': ['R$ 2.5 to 3.5 million', 'R$ 2,5 a 3,5 millones'], 'R$ 4 a 6 milhões': ['R$ 4 to 6 million', 'R$ 4 a 6 millones'],
  'Imóvel': ['Property', 'Inmueble'], 'Na planta': ['Off-plan', 'En pozo'], 'Pronto': ['Ready to move in', 'Terminado'],
  'Prefiro contato por': ['I prefer contact by', 'Prefiero contacto por'], 'Ligação': ['Phone call', 'Llamada'],
  'Autorizo a Guarita Imobiliária a entrar em contato comigo pelo canal escolhido.': ['I authorize Guarita Imobiliária to contact me through the chosen channel.', 'Autorizo a Guarita Imobiliária a contactarme por el canal elegido.'],
  'Autorizo a Guarita Imobiliária a entrar em contato comigo pelo WhatsApp informado.': ['I authorize Guarita Imobiliária to contact me on the WhatsApp number provided.', 'Autorizo a Guarita Imobiliária a contactarme por el WhatsApp informado.'],
  'Quero comprar': ['I want to buy', 'Quiero comprar'], 'Seus dados seguem pelo WhatsApp da Guarita.': ['Your details are sent through Guarita’s WhatsApp.', 'Sus datos se envían por el WhatsApp de Guarita.'],
  'Recebemos seu contato.': ['We received your message.', 'Recibimos su contacto.'],
  'Um especialista da Guarita vai falar com você em breve. Se a conversa no WhatsApp não abriu, use o botão abaixo.': ['A Guarita specialist will contact you shortly. If the WhatsApp chat did not open, use the button below.', 'Un especialista de Guarita se comunicará con usted en breve. Si la conversación de WhatsApp no se abrió, use el botón de abajo.'],
  'Continuar no WhatsApp': ['Continue on WhatsApp', 'Continuar en WhatsApp'], 'Enviar outra solicitação': ['Send another request', 'Enviar otra solicitud'],
  'Onde você quer morar?': ['Where do you want to live?', '¿Dónde quiere vivir?'], 'Conte como é o imóvel que você procura para alugar.': ['Tell us about the property you want to rent.', 'Cuéntenos cómo es el inmueble que busca alquilar.'],
  'Tipo de imóvel': ['Property type', 'Tipo de inmueble'], 'Dormitórios': ['Bedrooms', 'Dormitorios'], '4 ou mais': ['4 or more', '4 o más'], 'Quero alugar um imóvel': ['I want to rent a property', 'Quiero alquilar un inmueble'],
  'Seu imóvel bem cuidado. Você mais tranquilo.': ['Your property well cared for. Your mind at ease.', 'Su inmueble bien cuidado. Usted más tranquilo.'],
  'Quer colocar seu imóvel para alugar e contar com uma administração profissional? Converse com a Guarita.': ['Want to rent out your property with professional management? Talk to Guarita.', '¿Quiere alquilar su inmueble con una administración profesional? Hable con Guarita.'],
  'Para proprietários que desejam entregar o imóvel à Guarita para locação e administração.': ['For owners who want Guarita to rent out and manage their property.', 'Para propietarios que desean confiar a Guarita el alquiler y la administración de su inmueble.'],
  'Cidade do imóvel': ['Property city', 'Ciudad del inmueble'], 'Outra cidade': ['Other city', 'Otra ciudad'], 'Bairro': ['Neighborhood', 'Barrio'], '(opcional)': ['(optional)', '(opcional)'],
  'O imóvel está': ['The property is', 'El inmueble está'], 'Mobiliado': ['Furnished', 'Amueblado'], 'Semimobiliado': ['Semi-furnished', 'Semiamueblado'], 'Sem mobília': ['Unfurnished', 'Sin muebles'],
  'Quero que a Guarita administre meu imóvel': ['I want Guarita to manage my property', 'Quiero que Guarita administre mi inmueble'],
  'A Guarita vai falar com você em breve sobre a locação e a administração do seu imóvel. Se a conversa no WhatsApp não abriu, use o botão abaixo.': ['Guarita will contact you shortly about renting out and managing your property. If the WhatsApp chat did not open, use the button below.', 'Guarita se comunicará con usted en breve sobre el alquiler y la administración de su inmueble. Si la conversación de WhatsApp no se abrió, use el botón de abajo.'],
  'Informe seu nome.': ['Please enter your name.', 'Ingrese su nombre.'], 'Informe um WhatsApp com DDD.': ['Please enter a WhatsApp number with area code.', 'Ingrese un WhatsApp con código de área.'],
  'Selecione uma opção.': ['Please select an option.', 'Seleccione una opción.'], 'Autorize o contato para enviar.': ['Please authorize contact to send.', 'Autorice el contacto para enviar.'],
  // rodapé
  'Endereço': ['Address', 'Dirección'], 'Navegue': ['Browse', 'Navegue'], 'Abrir no Google Maps': ['Open in Google Maps', 'Abrir en Google Maps'],
  'Guarita Imobiliária. Todos os direitos reservados.': ['Guarita Imobiliária. All rights reserved.', 'Guarita Imobiliária. Todos los derechos reservados.'],
  'Créditos das fotografias': ['Photo credits', 'Créditos de las fotografías'],
  // página do imóvel
  'Você está em': ['You are here', 'Usted está en'], 'Carregando…': ['Loading…', 'Cargando…'], 'Carregando o imóvel…': ['Loading property…', 'Cargando el inmueble…'],
  'Informações técnicas': ['Specifications', 'Ficha técnica'], 'Sobre o imóvel': ['About the property', 'Sobre el inmueble'], 'Características e diferenciais': ['Features and highlights', 'Características y diferenciales'],
  'Informações complementares': ['Additional information', 'Información complementaria'], 'Localização': ['Location', 'Ubicación'], 'Ver no Google Maps': ['View on Google Maps', 'Ver en Google Maps'],
  'Falar no WhatsApp sobre este imóvel': ['Ask about this property on WhatsApp', 'Consultar por WhatsApp sobre este inmueble'], 'Outras opções de atendimento': ['Other ways to contact us', 'Otras opciones de atención'],
  'Atendimento direto com um especialista da Guarita.': ['Direct service with a Guarita specialist.', 'Atención directa con un especialista de Guarita.'],
  'Imóvel não encontrado': ['Property not found', 'Inmueble no encontrado'], 'Este anúncio não está disponível.': ['This listing is not available.', 'Este anuncio no está disponible.'],
  'O imóvel pode ter sido vendido, alugado ou retirado do site. Veja os outros imóveis ou fale com a Guarita.': ['The property may have been sold, rented or removed. See other properties or talk to Guarita.', 'El inmueble puede haber sido vendido, alquilado o retirado. Vea otros inmuebles o hable con Guarita.'],
  'Tenho interesse': ['I’m interested', 'Me interesa'], 'Fechar galeria': ['Close gallery', 'Cerrar galería'], 'Foto anterior': ['Previous photo', 'Foto anterior'], 'Próxima foto': ['Next photo', 'Foto siguiente'],
  'Tipo': ['Type', 'Tipo'], 'Venda': ['Sale', 'Venta'], 'Locação': ['Rent', 'Alquiler'], 'Suítes': ['Suites', 'Suites'], 'Banheiros': ['Bathrooms', 'Baños'], 'Vagas': ['Parking spaces', 'Cocheras'],
  'Área privativa': ['Private area', 'Área privada'], 'Área total': ['Total area', 'Área total'], 'Referência': ['Reference', 'Referencia'], 'Referência {c}': ['Reference {c}', 'Referencia {c}'],
  'Ver as {n} fotos': ['View all {n} photos', 'Ver las {n} fotos'], 'Não encontrado': ['Not found', 'No encontrado'], '/mês': ['/month', '/mes'], 'foto principal': ['main photo', 'foto principal'],
  'foto {a} de {b}': ['photo {a} of {b}', 'foto {a} de {b}'], 'Abrir galeria': ['Open gallery', 'Abrir galería'], 'Foto': ['Photo', 'Foto'],
  'Não foi possível carregar o imóvel agora. Tente novamente em instantes ou fale com a Guarita pelo WhatsApp.': ['The property could not be loaded right now. Please try again shortly or talk to Guarita on WhatsApp.', 'No fue posible cargar el inmueble ahora. Intente nuevamente en unos instantes o hable con Guarita por WhatsApp.']
};
const idx = lang === 'en' ? 0 : 1;
/* t('texto') ou t('{n} fotos', { n: 3 }) */
function t(s, vars) {
  if (s == null) return s;
  let r = s;
  if (lang !== 'pt') { const k = String(s).trim(), v = D[k]; if (v) r = String(s).replace(k, v[idx]); }
  if (vars) r = r.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
  return r;
}
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
function apply(root) {
  if (lang === 'pt' || !root) return;
  // mantém o valor em português das opções (as mensagens para a Guarita continuam em português)
  root.querySelectorAll('option').forEach(o => { if (!o.hasAttribute('value')) o.setAttribute('value', o.textContent); o.dataset.pt = o.textContent.trim(); });
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(n => { const k = n.nodeValue.replace(/\s+/g, ' ').trim(); if (k && D[k]) n.nodeValue = n.nodeValue.replace(/\S[\s\S]*\S|\S/, D[k][idx]); });
  root.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(el => ATTRS.forEach(a => { const v = el.getAttribute(a); if (v && D[v.trim()]) el.setAttribute(a, D[v.trim()][idx]); }));
}
document.documentElement.lang = { pt: 'pt-BR', en: 'en', es: 'es' }[lang];
if (lang !== 'pt') { document.title = t(document.title); apply(document.body); }

/* seletor de idioma */
const sel = document.getElementById('lang');
if (sel) {
  const atual = sel.querySelector(`[data-lang="${lang}"]`);
  if (atual) { atual.setAttribute('aria-current', 'true'); const flag = atual.querySelector('.flag'); const cur = sel.querySelector('.lang-cur'); if (flag && cur) cur.innerHTML = flag.outerHTML + `<b>${lang.toUpperCase()}</b>`; }
  sel.addEventListener('click', e => {
    const b = e.target.closest('[data-lang]'); if (!b) return;
    try { localStorage.setItem('guarita-lang', b.dataset.lang); } catch (_) {}
    const u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u.href);
  });
  document.addEventListener('click', e => { if (sel.open && !sel.contains(e.target)) sel.open = false; });
}
window.I18N = { lang, t, apply };
})();
