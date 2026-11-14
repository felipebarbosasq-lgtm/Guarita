-- Testes das regras de segurança. Cada bloco deve terminar com "OK".
\set ON_ERROR_STOP 1
insert into auth.users (id,email,encrypted_password) values
 ('11111111-1111-1111-1111-111111111111','admin@teste.local',crypt('senha-admin-123',gen_salt('bf'))),
 ('22222222-2222-2222-2222-222222222222','intruso@teste.local',crypt('senha-intruso-123',gen_salt('bf')))
on conflict do nothing;
insert into public.admins (user_id,email,nome) values ('11111111-1111-1111-1111-111111111111','admin@teste.local','Admin Teste') on conflict do nothing;
insert into public.imoveis (slug,nome,cidade,publicado) values ('rascunho-teste','Rascunho Teste','Itapema',false) on conflict do nothing;

create or replace function pg_temp.expect_fail(q text, label text) returns text language plpgsql as $$
declare n int;
begin execute q; get diagnostics n = row_count;
  if n = 0 then return 'OK nada alterado: ' || label; end if;
  raise exception 'FALHOU (deveria ser bloqueado): %', label;
exception when insufficient_privilege or check_violation then return 'OK bloqueado: ' || label;
  when others then if sqlerrm like 'FALHOU%' then raise; end if; return 'OK bloqueado (' || sqlstate || '): ' || label; end $$;

-- visitante anônimo
begin; set local role anon; select set_config('request.jwt.claims','{"role":"anon"}',true);
select case when count(*)=1 then 'OK visitante vê só publicados ('||count(*)||')' else 'FALHOU' end from imoveis_site;
select pg_temp.expect_fail($$insert into imoveis (slug,nome,cidade) values ('x-anon','X','Y')$$,'visitante cadastrar');
select pg_temp.expect_fail($$update imoveis set valor=1$$,'visitante alterar');
select pg_temp.expect_fail($$delete from imoveis$$,'visitante excluir');
select pg_temp.expect_fail($$insert into storage.objects (bucket_id,name) values ('imoveis','x/anon.webp')$$,'visitante enviar foto');
rollback;

-- usuário logado que NÃO é administrador
begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',true);
select case when count(*)=1 then 'OK não-admin vê só publicados (vitrine)' else 'FALHOU' end from imoveis_site;
select case when count(*)=0 then 'OK não-admin não lê a tabela completa' else 'FALHOU' end from imoveis;
select pg_temp.expect_fail($$insert into imoveis (slug,nome,cidade) values ('x-intruso','X','Y')$$,'não-admin cadastrar');
select pg_temp.expect_fail($$update imoveis set valor=1$$,'não-admin alterar');
select pg_temp.expect_fail($$delete from imoveis$$,'não-admin excluir');
select pg_temp.expect_fail($$select reordenar_imoveis(array[]::uuid[])$$,'não-admin reordenar');
select pg_temp.expect_fail($$insert into storage.objects (bucket_id,name) values ('imoveis','x/intruso.webp')$$,'não-admin enviar foto');
select case when count(*)=0 then 'OK não-admin não lê lista de admins alheia' else 'FALHOU' end from admins;
rollback;

-- administrador
begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',true);
select case when count(*)=2 then 'OK admin vê rascunhos também' else 'FALHOU' end from imoveis;
insert into imoveis (slug,nome,cidade,valor) values ('novo-admin','Novo Admin','Itapema',1500000);
select case when codigo ~ '^GUA-\d{4}$' then 'OK código gerado: '||codigo else 'FALHOU' end from imoveis where slug='novo-admin';
select pg_temp.expect_fail($$insert into imoveis (slug,nome,cidade) values ('Slug Inválido','X','Y')$$,'slug inválido');
select pg_temp.expect_fail($$insert into imoveis (slug,nome,cidade,valor) values ('neg','Neg','Y',-5)$$,'valor negativo');
select pg_temp.expect_fail($$insert into imoveis (slug,nome,cidade,dormitorios,suites) values ('ste','Ste','Y',2,3)$$,'suítes > dormitórios');
insert into storage.objects (bucket_id,name) values ('imoveis','x/admin.webp');
select 'OK admin envia foto';
select reordenar_imoveis(array(select id from imoveis order by nome));
select 'OK admin reordena';
rollback;
