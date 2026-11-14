-- Testes da unidade oculta (depois de schema + atualizações). Cada linha deve começar com OK.
\set ON_ERROR_STOP 1
insert into public.imoveis (slug, nome, cidade, complemento, endereco, publicado, ocultar_unidade)
values ('teste-oculto-apartamento', 'Residencial Oculto', 'Itapema', '104', 'Rua Francisco Bezerra, 320', true, true),
       ('teste-visivel-apartamento-205', 'Residencial Visível', 'Itapema', '205', 'Rua X, 10', true, false)
on conflict do nothing;
create or replace function pg_temp.falha(q text, label text) returns text language plpgsql as $$
declare n int; begin execute q; get diagnostics n = row_count; if n = 0 then return 'OK nada lido: '||label; end if; raise exception 'FALHOU: %', label;
exception when others then if sqlerrm like 'FALHOU%' then raise; end if; return 'OK bloqueado: '||label; end $$;
begin; set local role anon; select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.falha($$select complemento from public.imoveis$$, 'visitante ler a tabela completa');
select case when complemento is null and endereco = 'Rua Francisco Bezerra, 320' then 'OK vitrine: apartamento oculto, rua e número do prédio visíveis' else 'FALHOU' end from public.imoveis_site where nome='Residencial Oculto';
select case when complemento = '205' then 'OK vitrine: apartamento visível quando o botão está ligado' else 'FALHOU' end from public.imoveis_site where nome='Residencial Visível';
select case when count(*) = 0 then 'OK vitrine não mostra rascunhos' else 'FALHOU' end from public.imoveis_site where publicado = false;
commit;
begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',true);
select case when complemento = '104' then 'OK painel (admin) vê o apartamento' else 'FALHOU' end from public.imoveis where nome='Residencial Oculto';
commit;
select case when column_default = 'true' then 'OK novos imóveis já nascem com a unidade oculta' else 'FALHOU '||column_default end from information_schema.columns where table_name='imoveis' and column_name='ocultar_unidade';
select case when ocultar_unidade = false then 'OK imóveis antigos continuam com a unidade visível' else 'FALHOU' end from public.imoveis where codigo='GUA-0001';
