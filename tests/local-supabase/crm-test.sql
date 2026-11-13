-- Testes do CRM (rodar depois de schema + atualizações 2, 3 e 4). Cada linha deve começar com OK.
\set ON_ERROR_STOP 1
insert into auth.users (id,email,encrypted_password) values
 ('11111111-1111-1111-1111-111111111111','admin@teste.local',crypt('senha-admin-123',gen_salt('bf'))),
 ('33333333-3333-3333-3333-333333333333','joao@teste.local',crypt('senha-joao-123',gen_salt('bf'))),
 ('44444444-4444-4444-4444-444444444444','maria@teste.local',crypt('senha-maria-123',gen_salt('bf'))),
 ('55555555-5555-5555-5555-555555555555','novo@teste.local',crypt('x',gen_salt('bf')))
on conflict do nothing;
insert into public.admins (user_id,email,nome,papel) values ('11111111-1111-1111-1111-111111111111','admin@teste.local','Gestora','gestor') on conflict do nothing;
create or replace function pg_temp.como(uid text) returns void language sql as $$ select set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true) $$;
create or replace function pg_temp.falha(q text, label text) returns text language plpgsql as $$
declare n int; begin execute q; get diagnostics n = row_count; if n = 0 then return 'OK nada feito: '||label; end if; raise exception 'FALHOU: %', label;
exception when others then if sqlerrm like 'FALHOU%' then raise; end if; return 'OK bloqueado: '||label||' ('||left(sqlerrm,70)||')'; end $$;

-- gestor monta a equipe pelo painel
begin; set local role authenticated; select pg_temp.como('11111111-1111-1111-1111-111111111111');
select public.equipe_salvar('joao@teste.local','João Corretor','corretor','47 99999-0001',true,true);
select public.equipe_salvar('maria@teste.local','Maria Corretora','corretor',null,true,true);
select pg_temp.falha($$select public.equipe_salvar('naoexiste@teste.local','Fulano','corretor',null,true,true)$$,'e-mail sem login');
select pg_temp.falha($$select public.equipe_salvar('admin@teste.local','Gestora','corretor',null,true,true)$$,'deixar a equipe sem gestor');
commit;
select 'OK equipe: '||string_agg(nome||'/'||papel, ', ' order by nome) from public.admins;

-- corretor João cadastra cliente; Maria tenta o mesmo WhatsApp
begin; set local role authenticated; select pg_temp.como('33333333-3333-3333-3333-333333333333');
insert into clientes (nome, whatsapp, interesse) values ('Cliente do João', '+55 (47) 98888-1111', 'comprar');
select case when corretor_id='33333333-3333-3333-3333-333333333333' and whatsapp='47988881111' then 'OK cliente fica com quem cadastrou, fone normalizado' else 'FALHOU' end from clientes where nome='Cliente do João';
select pg_temp.falha($$select public.equipe_salvar('maria@teste.local','M','gestor',null,true,true)$$,'corretor mexer na equipe');
commit;
begin; set local role authenticated; select pg_temp.como('44444444-4444-4444-4444-444444444444');
select case when corretor_nome='João Corretor' and cliente_id is null and not meu then 'OK duplicidade mostra quem atende (João), sem expor o cliente' else 'FALHOU' end from public.cliente_dono('47988881111');
select pg_temp.falha($$insert into clientes (nome, whatsapp) values ('Copia', '(47) 98888-1111')$$,'cadastrar WhatsApp repetido');
select case when count(*)=0 then 'OK Maria não vê clientes do João' else 'FALHOU' end from clientes;
select pg_temp.falha($$update clientes set etapa='fechado'$$,'Maria alterar cliente do João');
select pg_temp.falha($$delete from clientes$$,'corretor excluir cliente');
insert into clientes (nome, whatsapp) values ('Cliente da Maria', '47977772222');
commit;
begin; set local role authenticated; select pg_temp.como('33333333-3333-3333-3333-333333333333');
update clientes set etapa='visita', proximo_contato=current_date+1 where nome='Cliente do João';
select pg_temp.falha($$update clientes set corretor_id='44444444-4444-4444-4444-444444444444'$$,'corretor transferir cliente');
insert into atendimentos (cliente_id, tipo, texto) select id,'ligacao','Ligou, quer visitar sábado' from clientes where nome='Cliente do João';
select pg_temp.falha($$insert into atendimentos (cliente_id, tipo, texto) select id,'sistema','x' from clientes$$,'forjar anotação do sistema');
select 'OK histórico do João: '||string_agg(tipo||'='||texto, ' | ' order by created_at) from atendimentos;
commit;

-- gestor vê tudo e transfere
begin; set local role authenticated; select pg_temp.como('11111111-1111-1111-1111-111111111111');
select case when count(*)=2 then 'OK gestor vê todos os clientes' else 'FALHOU' end from clientes;
update clientes set corretor_id='44444444-4444-4444-4444-444444444444' where nome='Cliente do João';
select 'OK '||texto from atendimentos where texto like 'Transferido%';
update crm_config set rodizio = true;
commit;

-- contatos do site (visitante anônimo): rodízio
begin; set local role anon; select set_config('request.jwt.claims','{"role":"anon"}',true);
select public.lead_do_site('Visitante Um','(47) 91111-0001','Compra','{"Região":"Itapema","Faixa de valor":"R$ 1 a 2 milhões"}');
select public.lead_do_site('Visitante Dois','47911110002','Locação','{}');
select public.lead_do_site('Visitante Três','47911110003','Compra','{}');
select public.lead_do_site('Visitante Um de novo','47911110001','Compra','{}');
select public.lead_do_site('X','123','Compra','{}');
select pg_temp.falha($$select * from clientes$$,'visitante ler clientes');
commit;
select 'OK rodízio: '||string_agg(c.nome||'→'||coalesce(a.nome,'-'), ', ' order by c.created_at) from clientes c left join admins a on a.user_id=c.corretor_id where c.origem='site';
select case when count(*)=3 then 'OK sem duplicar quem já é cliente e ignora dados inválidos' else 'FALHOU '||count(*) end from clientes where origem='site';
-- manual
update crm_config set rodizio=false;
begin; set local role anon; select set_config('request.jwt.claims','{"role":"anon"}',true);
select public.lead_do_site('Visitante Manual','47911110009','Administração de imóvel para locação','{"Cidade do imóvel":"Porto Belo"}');
commit;
select case when corretor_id is null and interesse='anunciar' and regiao='Porto Belo' then 'OK modo manual: fica sem corretor aguardando o gestor' else 'FALHOU' end from clientes where nome='Visitante Manual';
-- corretor desativado perde acesso
update admins set ativo=false where email='maria@teste.local';
begin; set local role authenticated; select pg_temp.como('44444444-4444-4444-4444-444444444444');
select case when count(*)=0 and not public.is_admin() then 'OK corretor desativado não vê nada' else 'FALHOU' end from clientes;
commit;
