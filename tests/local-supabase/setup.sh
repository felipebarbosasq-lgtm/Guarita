#!/usr/bin/env bash
# Prepara um banco PostgreSQL local "guarita_test" para testes (Linux com PostgreSQL 16 instalado).
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
pg_ctlcluster 16 main start 2>/dev/null || true
cd /tmp
su postgres -c "psql -q -c \"alter user postgres password 'postgres'\""
su postgres -c "psql -q -c 'drop database if exists guarita_test' -c 'create database guarita_test'"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -d guarita_test -f '$DIR/tests/local-supabase/stub.sql' -f '$DIR/supabase/schema.sql' -f '$DIR/supabase/seed.sql'" 2>&1 | grep -v NOTICE || true
# usuários de teste: um administrador e um usuário comum (sem permissão)
su postgres -c "psql -q -d guarita_test" <<'SQL'
insert into auth.users (id,email,encrypted_password) values
 ('11111111-1111-1111-1111-111111111111','admin@teste.local',crypt('senha-admin-123',gen_salt('bf'))),
 ('22222222-2222-2222-2222-222222222222','intruso@teste.local',crypt('senha-intruso-123',gen_salt('bf')));
insert into public.admins (user_id,email,nome) values ('11111111-1111-1111-1111-111111111111','admin@teste.local','Admin Teste');
SQL
rm -rf /tmp/guarita-storage
echo "Banco guarita_test pronto."
