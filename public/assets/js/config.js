/* ===== CONFIGURAÇÃO CENTRAL DO SITE =====
   No Netlify, os campos marcados com [build] são preenchidos automaticamente a partir das
   variáveis de ambiente (veja .env.example e tools/build-config.mjs). Os demais podem ser editados aqui.

   Sem supabaseUrl/supabaseAnonKey o site funciona em "modo demonstração": mostra os imóveis
   de assets/js/demo-data.js e o painel /admin fica indisponível. */
window.GUARITA_CONFIG = {
  supabaseUrl: 'https://hszjbgoldgfvzkuyacai.supabase.co',          // [build] SUPABASE_URL      ex.: https://abcdefgh.supabase.co
  supabaseAnonKey: 'sb_publishable_HhL68TDgEY4D6ZvfG6WaFw_iPmLU82H',      // [build] SUPABASE_ANON_KEY chave pública "anon" (protegida pelas regras RLS do banco)
  storageBucket: 'imoveis', // [build] SUPABASE_BUCKET   bucket público das fotos dos imóveis
  siteUrl: 'https://guaritaimobiliaria.netlify.app',              // [build] SITE_URL          ex.: https://www.guaritaimobiliaria.com.br
  prettyUrls: false,        // [build] true no Netlify: /imovel/nome-do-imovel. Localmente usa imovel/index.html?i=nome

  whatsapp: '554791127088',               // DDI+DDD+número, só dígitos
  email: 'imobiliariaguarita@hotmail.com', // exibido no rodapé; o visitante nunca informa e-mail
  instagram: 'https://www.instagram.com/imobiliariaguarita',
  creci: 'CRECI 66.404',
  // Cópia opcional de cada contato para a caixa da imobiliária (FormSubmit). Deixe '' para desativar.
  leadCopyEndpoint: 'https://formsubmit.co/ajax/imobiliariaguarita@hotmail.com',
  waHello: 'Olá! Vim pelo site da Guarita Imobiliária e gostaria de atendimento.'
};
