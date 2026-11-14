#!/usr/bin/env node
/* Roda todos os testes locais: regras de segurança do banco + testes no navegador.
   Requer Linux com PostgreSQL 16 e Chromium/Playwright. */
import { execSync, spawn } from 'node:child_process';
const run = c => execSync(c, { stdio: 'inherit' });
run('bash tests/local-supabase/setup.sh');
for (const f of ['rls-test.sql', 'crm-test.sql', 'unidade-test.sql']) {
  run('bash tests/local-supabase/setup.sh');
  const out = execSync(`cd /tmp && su postgres -c "psql -q -t -d guarita_test -f '${process.cwd()}/tests/local-supabase/${f}'" 2>&1`).toString();
  console.log(out.split('\n').map(l => l.trim()).filter(l => /^OK|FALH|ERRO|ERROR/.test(l)).join('\n'));
  if (/FALHOU|ERROR/.test(out)) { console.error(f + ': falhou'); process.exit(1); }
}
run('bash tests/local-supabase/setup.sh');
// NODE_USE_ENV_PROXY: em ambientes com proxy de saída, a função /api/dwv precisa dele para acessar o DWV
const srv = spawn('node', ['tests/local-supabase/server.mjs'], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
await new Promise(r => setTimeout(r, 1500));
try { run('node tests/e2e.mjs'); } finally { srv.kill(); }
