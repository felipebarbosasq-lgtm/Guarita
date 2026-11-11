#!/usr/bin/env node
/* Roda todos os testes locais: regras de segurança do banco + testes no navegador.
   Requer Linux com PostgreSQL 16 e Chromium/Playwright. */
import { execSync, spawn } from 'node:child_process';
const run = c => execSync(c, { stdio: 'inherit' });
run('bash tests/local-supabase/setup.sh');
run(`cd /tmp && su postgres -c "psql -q -t -d guarita_test -f '${process.cwd()}/tests/local-supabase/rls-test.sql'"`);
run('bash tests/local-supabase/setup.sh');
const srv = spawn('node', ['tests/local-supabase/server.mjs'], { stdio: 'inherit' });
await new Promise(r => setTimeout(r, 1500));
try { run('node tests/e2e.mjs'); } finally { srv.kill(); }
