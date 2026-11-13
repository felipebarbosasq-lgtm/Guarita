#!/usr/bin/env node
/* Executado pelo Netlify a cada publicação (netlify.toml > build.command).
   Copia as variáveis de ambiente públicas para public/assets/js/config.js e gera public/robots.txt.
   As variáveis são OPCIONAIS: sem elas, valem os valores já escritos em config.js.
   Uso local:  SUPABASE_URL=... SUPABASE_ANON_KEY=... SITE_URL=... node tools/build-config.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const file = join(root, 'public/assets/js/config.js');
let cfg = readFileSync(file, 'utf8');
const cur = name => ((cfg.match(new RegExp(`\\n\\s*${name}:\\s*'([^']*)'`)) || [])[1] || '');
const url = (env.SUPABASE_URL || cur('supabaseUrl')).trim().replace(/\/+$/, '');
const key = (env.SUPABASE_ANON_KEY || cur('supabaseAnonKey')).trim();
const bucket = (env.SUPABASE_BUCKET || cur('storageBucket') || 'imoveis').trim();
const site = (env.SITE_URL || cur('siteUrl') || env.URL || '').trim().replace(/\/+$/, ''); // URL é definida pelo próprio Netlify

if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$|^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) {
  console.error(`SUPABASE_URL inválida: "${url}". Use o endereço do projeto, ex.: https://abcdefgh.supabase.co`); process.exit(1);
}
if (url && !key) { console.error('SUPABASE_URL definida, mas falta SUPABASE_ANON_KEY.'); process.exit(1); }
if (key && /^sb_secret_/.test(key)) { console.error('A chave informada é a "secret" (sb_secret_…). Use a "publishable" (sb_publishable_…) ou a "anon public".'); process.exit(1); }
if (key && /service_role/.test(Buffer.from((key.split('.')[1] || ''), 'base64').toString())) {
  console.error('A chave informada em SUPABASE_ANON_KEY é a "service_role" (secreta). Use a chave "anon public".'); process.exit(1);
}

const set = (name, value) => {
  const re = new RegExp(`(\\n\\s*${name}:\\s*)([^,\\n]+)(,)`);
  if (!re.test(cfg)) { console.error(`Campo ${name} não encontrado em config.js`); process.exit(1); }
  cfg = cfg.replace(re, (_, a, _b, c) => a + JSON.stringify(value).replace(/"/g, "'") + c);
};
set('supabaseUrl', url); set('supabaseAnonKey', key); set('storageBucket', bucket); set('siteUrl', site);
set('prettyUrls', true);
writeFileSync(file, cfg);

// as funções do Netlify (sitemap e metadados) usam os mesmos valores
writeFileSync(join(root, 'netlify/shared/config.gen.mjs'),
  `// Gerado por tools/build-config.mjs a cada publicação.\nexport default ${JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key, siteUrl: site })};\n`);

writeFileSync(join(root, 'public/robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /admin/\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ''}`);

console.log(`config.js atualizado: banco ${url ? 'conectado (' + url + ')' : 'NÃO configurado (modo demonstração)'}, site ${site || '(sem SITE_URL)'}.`);
