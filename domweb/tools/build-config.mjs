// Gera public/js/config.js com as chaves PÚBLICAS do Supabase (roda no build do Netlify).
// Sem SUPABASE_URL/SUPABASE_ANON_KEY o site funciona em modo demonstração.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  whatsappApi: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
};
const js = `// Gerado por tools/build-config.mjs a partir das variáveis do Netlify.\n// Vazio = modo demonstração (dados salvos só no navegador).\nwindow.DOMWEB_CONFIG = ${JSON.stringify(cfg)};\n`;
await fs.writeFile(path.join(raiz, 'public/js/config.js'), js);
console.log(`config.js gerado (${cfg.supabaseUrl ? 'Supabase' : 'modo demonstração'}${cfg.whatsappApi ? ' + WhatsApp' : ''})`);
