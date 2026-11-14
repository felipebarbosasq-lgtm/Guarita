// Gera supabase/seed.sql a partir de public/data/loja-inicial.json.
// Uso: npm run seed-sql  → depois rode o arquivo no SQL Editor do Supabase.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dados = JSON.parse(await fs.readFile(path.join(raiz, 'public/data/loja-inicial.json'), 'utf8'));
const { cupons = [], versao, ...publico } = dados;
const json = JSON.stringify(publico).replace(/'/g, "''");

let sql = `-- DOM Web: cardápio inicial (gerado por tools/gerar-seed-sql.mjs)\n`;
sql += `insert into public.cardapio (id, dados) values (1, '${json}'::jsonb)\non conflict (id) do update set dados = excluded.dados, atualizado_em = now();\n`;
for (const c of cupons) {
  sql += `insert into public.cupons (id, codigo, tipo, valor, minimo, ativo) values ('${c.id}', '${c.codigo}', '${c.tipo}', ${c.valor}, ${c.minimo || 0}, ${!!c.ativo}) on conflict (id) do nothing;\n`;
}
await fs.writeFile(path.join(raiz, 'supabase/seed.sql'), sql);
console.log('supabase/seed.sql gerado');
