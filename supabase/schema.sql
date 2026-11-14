-- =====================================================================
-- Guarita Imobiliária: banco de dados (Supabase / PostgreSQL)
-- Execute este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Pode ser executado de novo sem perder dados (idempotente).
--
-- Segurança
--  * Visitantes (chave pública "anon") só LEEM imóveis publicados.
--  * Cadastrar, editar, excluir e enviar fotos exige login de um usuário
--    que esteja na tabela public.admins. A regra é aplicada pelo próprio
--    banco (Row Level Security), não pelo navegador.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- administradores autorizados ----------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  nome       text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins: leitura do próprio registro" on public.admins;
create policy "admins: leitura do próprio registro" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ---------- imóveis ----------
create sequence if not exists public.imoveis_codigo_seq start 2;  -- GUA-0001 é o Eleganza Tower (seed.sql)

create table if not exists public.imoveis (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  codigo            text not null unique default ('GUA-' || lpad(nextval('public.imoveis_codigo_seq')::text, 4, '0'))
                    check (length(codigo) between 1 and 40),
  nome              text not null check (length(btrim(nome)) between 2 and 120),
  tipo              text not null default 'Apartamento' check (length(tipo) <= 60),
  complemento       text check (length(complemento) <= 60),        -- ex.: número da unidade "4200"
  finalidade        text not null default 'venda' check (finalidade in ('venda', 'locacao')),
  endereco          text check (length(endereco) <= 200),
  bairro            text check (length(bairro) <= 100),
  cidade            text not null check (length(btrim(cidade)) between 2 and 100),
  estado            text not null default 'SC' check (estado ~ '^[A-Z]{2}$'),
  valor             numeric(14, 2) check (valor >= 0),
  area_privativa    numeric(10, 2) check (area_privativa > 0),
  area_total        numeric(10, 2) check (area_total > 0),
  dormitorios       smallint check (dormitorios between 0 and 50),
  suites            smallint check (suites between 0 and 50),
  banheiros         smallint check (banheiros between 0 and 50),
  vagas             smallint check (vagas between 0 and 50),
  descricao         text not null default '' check (length(descricao) <= 8000),
  caracteristicas   text[] not null default '{}' check (cardinality(caracteristicas) <= 80),
  info_complementar text not null default '' check (length(info_complementar) <= 4000),
  status            text not null default 'disponivel' check (status in ('disponivel', 'reservado', 'vendido', 'alugado')),
  publicado         boolean not null default false,
  destaque          boolean not null default false,
  ordem             integer not null default 0,
  -- fotos: [{ "lg": url, "md": url, "th": url, "w": 1920, "h": 1280, "alt": "", "key": "pasta/arquivo" }, ...]
  -- a primeira foto é a capa
  fotos             jsonb not null default '[]'::jsonb check (jsonb_typeof(fotos) = 'array' and jsonb_array_length(fotos) <= 60),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint suites_ate_dormitorios check (suites is null or dormitorios is null or suites <= dormitorios)
);

-- oportunidade e preço "de/por" (atualização 2; também em supabase/atualizacao-02-oportunidade.sql)
alter table public.imoveis add column if not exists oportunidade boolean not null default false;
alter table public.imoveis add column if not exists valor_anterior numeric(14, 2);
alter table public.imoveis drop constraint if exists valor_anterior_maior;
alter table public.imoveis add constraint valor_anterior_maior
  check (valor_anterior is null or (valor_anterior > 0 and (valor is null or valor_anterior > valor)));

create index if not exists imoveis_publicos_idx on public.imoveis (publicado, destaque desc, ordem, created_at desc);

create or replace function public.imoveis_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := 'GUA-' || lpad(nextval('public.imoveis_codigo_seq')::text, 4, '0');
  end if;
  new.codigo := upper(btrim(new.codigo));
  new.nome := btrim(new.nome);
  return new;
end $$;
drop trigger if exists imoveis_touch on public.imoveis;
create trigger imoveis_touch before insert or update on public.imoveis
  for each row execute function public.imoveis_touch();

alter table public.imoveis enable row level security;

drop policy if exists "imoveis: público lê publicados" on public.imoveis;
create policy "imoveis: público lê publicados" on public.imoveis
  for select to anon, authenticated using (publicado = true or public.is_admin());

drop policy if exists "imoveis: admin cadastra" on public.imoveis;
create policy "imoveis: admin cadastra" on public.imoveis
  for insert to authenticated with check (public.is_admin());

drop policy if exists "imoveis: admin edita" on public.imoveis;
create policy "imoveis: admin edita" on public.imoveis
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "imoveis: admin exclui" on public.imoveis;
create policy "imoveis: admin exclui" on public.imoveis
  for delete to authenticated using (public.is_admin());

grant select on public.imoveis to anon, authenticated;
grant insert, update, delete on public.imoveis to authenticated;
grant usage on sequence public.imoveis_codigo_seq to authenticated;
grant select on public.admins to authenticated;

-- reordenar vários imóveis de uma vez (painel > arrastar/setas)
create or replace function public.reordenar_imoveis(ids uuid[])
returns void language plpgsql security invoker as $$
begin
  if not public.is_admin() then raise exception 'acesso negado' using errcode = '42501'; end if;
  update public.imoveis i set ordem = x.pos
    from unnest(ids) with ordinality as x(id, pos) where i.id = x.id;
end $$;
revoke all on function public.reordenar_imoveis(uuid[]) from public;
grant execute on function public.reordenar_imoveis(uuid[]) to authenticated;

-- ---------- fotos (Supabase Storage) ----------
-- bucket público para leitura; gravação só para administradores; limite de 8 MB por arquivo já otimizado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imoveis', 'imoveis', true, 8388608, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos: público lê" on storage.objects;
create policy "fotos: público lê" on storage.objects
  for select to anon, authenticated using (bucket_id = 'imoveis');

drop policy if exists "fotos: admin envia" on storage.objects;
create policy "fotos: admin envia" on storage.objects
  for insert to authenticated with check (bucket_id = 'imoveis' and public.is_admin());

drop policy if exists "fotos: admin altera" on storage.objects;
create policy "fotos: admin altera" on storage.objects
  for update to authenticated using (bucket_id = 'imoveis' and public.is_admin()) with check (bucket_id = 'imoveis' and public.is_admin());

drop policy if exists "fotos: admin exclui" on storage.objects;
create policy "fotos: admin exclui" on storage.objects
  for delete to authenticated using (bucket_id = 'imoveis' and public.is_admin());

-- ===================== CRM (atualizações 3 e 4) =====================

-- supabase/atualizacao-03-crm-equipe-clientes.sql
-- =====================================================================
-- Guarita Imobiliária: atualização 3 (CRM, etapa 1: equipe e clientes)
-- Execute UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Não apaga dados. Quem já é administrador vira "gestor" (vê e faz tudo).
--
--  * Equipe: gestores e corretores (tabela admins, com papel e ativo).
--  * Clientes: cada cliente pertence a um corretor; o corretor só vê os seus,
--    o gestor vê todos e é o único que transfere ou exclui.
--  * Um mesmo WhatsApp (ou e-mail) não pode ser cadastrado duas vezes:
--    o sistema bloqueia e mostra quem está atendendo.
-- =====================================================================

-- ---------- equipe ----------
alter table public.admins add column if not exists papel text;
update public.admins set papel = 'gestor' where papel is null;           -- quem já existia vira gestor
alter table public.admins alter column papel set default 'corretor';
alter table public.admins alter column papel set not null;
alter table public.admins drop constraint if exists admins_papel_ok;
alter table public.admins add constraint admins_papel_ok check (papel in ('gestor', 'corretor'));
alter table public.admins add column if not exists ativo boolean not null default true;
alter table public.admins add column if not exists telefone text;
alter table public.admins add column if not exists recebe_rodizio boolean;
update public.admins set recebe_rodizio = (papel = 'corretor') where recebe_rodizio is null;  -- gestores fora do rodízio
alter table public.admins alter column recebe_rodizio set default true;
alter table public.admins alter column recebe_rodizio set not null;
alter table public.admins add column if not exists ultimo_lead_em timestamptz;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and ativo);
$$;
create or replace function public.is_gestor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and ativo and papel = 'gestor');
$$;
revoke all on function public.is_gestor() from public;
grant execute on function public.is_gestor() to anon, authenticated;

drop policy if exists "admins: leitura do próprio registro" on public.admins;
drop policy if exists "equipe: membros leem" on public.admins;
create policy "equipe: membros leem" on public.admins
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

-- imóveis: corretores cadastram e editam; só o gestor exclui
drop policy if exists "imoveis: admin exclui" on public.imoveis;
create policy "imoveis: admin exclui" on public.imoveis
  for delete to authenticated using (public.is_gestor());

-- cadastrar/alterar membro da equipe (o login é criado antes em Authentication > Users)
create or replace function public.equipe_salvar(p_email text, p_nome text, p_papel text, p_telefone text, p_ativo boolean, p_recebe_rodizio boolean)
returns void language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if not public.is_gestor() then raise exception 'Só o gestor pode alterar a equipe.' using errcode = '42501'; end if;
  if p_papel not in ('gestor', 'corretor') then raise exception 'Papel inválido.'; end if;
  if length(btrim(coalesce(p_nome, ''))) < 2 then raise exception 'Informe o nome.'; end if;
  select id into u from auth.users where lower(email) = lower(btrim(p_email));
  if u is null then
    raise exception 'Não existe login com o e-mail %. Crie primeiro no Supabase (Authentication > Users > Add user) e tente de novo.', btrim(p_email);
  end if;
  insert into public.admins (user_id, email, nome, papel, telefone, ativo, recebe_rodizio)
  values (u, lower(btrim(p_email)), btrim(p_nome), p_papel, nullif(btrim(coalesce(p_telefone, '')), ''), coalesce(p_ativo, true), coalesce(p_recebe_rodizio, true))
  on conflict (user_id) do update set nome = excluded.nome, papel = excluded.papel, telefone = excluded.telefone,
    ativo = excluded.ativo, recebe_rodizio = excluded.recebe_rodizio;
  if not exists (select 1 from public.admins where papel = 'gestor' and ativo) then
    raise exception 'A equipe precisa ter pelo menos um gestor ativo.';
  end if;
end $$;
revoke all on function public.equipe_salvar(text, text, text, text, boolean, boolean) from public;
grant execute on function public.equipe_salvar(text, text, text, text, boolean, boolean) to authenticated;

-- ---------- clientes ----------
create or replace function public.fone_digitos(t text)
returns text language sql immutable as $$
  select case when length(d) in (12, 13) and d like '55%' then substr(d, 3) else d end
  from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) x;
$$;

create table if not exists public.clientes (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (length(btrim(nome)) between 2 and 120),
  whatsapp         text not null,
  email            text check (email is null or length(email) <= 160),
  interesse        text not null default 'comprar' check (interesse in ('comprar', 'alugar', 'anunciar', 'investir')),
  faixa_valor      text check (length(faixa_valor) <= 80),
  regiao           text check (length(regiao) <= 120),
  observacoes      text not null default '' check (length(observacoes) <= 4000),
  etapa            text not null default 'novo' check (etapa in ('novo', 'atendimento', 'visita', 'proposta', 'fechado', 'perdido')),
  motivo_perda     text check (length(motivo_perda) <= 300),
  proximo_contato  date,
  imoveis          uuid[] not null default '{}',
  corretor_id      uuid references public.admins (user_id) on delete set null,
  origem           text not null default 'manual' check (origem in ('manual', 'site')),
  criado_por       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists clientes_whatsapp_unico on public.clientes (whatsapp);
create unique index if not exists clientes_email_unico on public.clientes (lower(email)) where email is not null;
create index if not exists clientes_corretor_idx on public.clientes (corretor_id, etapa);

create or replace function public.clientes_touch()
returns trigger language plpgsql as $$
begin
  new.whatsapp := public.fone_digitos(new.whatsapp);
  if length(new.whatsapp) not in (10, 11) then raise exception 'WhatsApp inválido: use DDD + número.' using errcode = '23514'; end if;
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.nome := btrim(new.nome);
  new.updated_at := now();
  if auth.uid() is not null and not public.is_gestor() then
    if tg_op = 'INSERT' then
      new.corretor_id := auth.uid();                    -- o corretor fica com o cliente que cadastrou
    elsif new.corretor_id is distinct from old.corretor_id then
      raise exception 'Só o gestor pode transferir clientes.' using errcode = '42501';
    end if;
  end if;
  if new.etapa <> 'perdido' then new.motivo_perda := null; end if;
  return new;
end $$;
drop trigger if exists clientes_touch on public.clientes;
create trigger clientes_touch before insert or update on public.clientes
  for each row execute function public.clientes_touch();

alter table public.clientes enable row level security;
drop policy if exists "clientes: ver" on public.clientes;
create policy "clientes: ver" on public.clientes for select to authenticated
  using (public.is_gestor() or (public.is_admin() and corretor_id = auth.uid()));
drop policy if exists "clientes: cadastrar" on public.clientes;
create policy "clientes: cadastrar" on public.clientes for insert to authenticated
  with check (public.is_gestor() or (public.is_admin() and corretor_id = auth.uid()));
drop policy if exists "clientes: editar" on public.clientes;
create policy "clientes: editar" on public.clientes for update to authenticated
  using (public.is_gestor() or (public.is_admin() and corretor_id = auth.uid()))
  with check (public.is_gestor() or (public.is_admin() and corretor_id = auth.uid()));
drop policy if exists "clientes: excluir" on public.clientes;
create policy "clientes: excluir" on public.clientes for delete to authenticated using (public.is_gestor());
grant select, insert, update, delete on public.clientes to authenticated;

-- quem já atende este cliente? (responde sem mostrar os dados do cliente a quem não é o dono)
create or replace function public.cliente_dono(p_whatsapp text, p_email text default null)
returns table (cliente_id uuid, corretor_nome text, desde timestamptz, meu boolean)
language plpgsql stable security definer set search_path = public as $$
declare d text := public.fone_digitos(p_whatsapp); e text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if not public.is_admin() then raise exception 'acesso negado' using errcode = '42501'; end if;
  return query
    select case when public.is_gestor() or c.corretor_id = auth.uid() then c.id end,
           coalesce(a.nome, a.email, 'ninguém (aguardando distribuição)'), c.created_at, c.corretor_id = auth.uid()
    from public.clientes c left join public.admins a on a.user_id = c.corretor_id
    where (length(d) >= 10 and c.whatsapp = d) or (e is not null and c.email = e)
    limit 1;
end $$;
revoke all on function public.cliente_dono(text, text) from public;
grant execute on function public.cliente_dono(text, text) to authenticated;

notify pgrst, 'reload schema';

-- supabase/atualizacao-04-crm-historico-rodizio.sql
-- =====================================================================
-- Guarita Imobiliária: atualização 4 (CRM, etapa 2: histórico, distribuição
-- e contatos do site). Execute UMA vez, DEPOIS da atualização 3.
--
--  * Histórico: cada ligação, mensagem, visita ou nota fica registrada;
--    mudanças de etapa e transferências são anotadas sozinhas.
--  * Contatos do site: os formulários Comprar, Alugar e Anunciar criam o
--    cliente no CRM. Distribuição por rodízio automático ou manual (o gestor
--    liga/desliga no painel, na aba Equipe).
-- =====================================================================

-- ---------- histórico de atendimento ----------
create table if not exists public.atendimentos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes (id) on delete cascade,
  autor_id    uuid default auth.uid(),
  tipo        text not null default 'nota' check (tipo in ('nota', 'ligacao', 'whatsapp', 'visita', 'email', 'sistema', 'site')),
  texto       text not null check (length(btrim(texto)) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists atendimentos_cliente_idx on public.atendimentos (cliente_id, created_at desc);

alter table public.atendimentos enable row level security;
drop policy if exists "atendimentos: ver" on public.atendimentos;
create policy "atendimentos: ver" on public.atendimentos for select to authenticated
  using (exists (select 1 from public.clientes c where c.id = cliente_id));        -- vale a regra de quem vê o cliente
drop policy if exists "atendimentos: anotar" on public.atendimentos;
create policy "atendimentos: anotar" on public.atendimentos for insert to authenticated
  with check (public.is_admin() and autor_id = auth.uid() and tipo not in ('sistema', 'site')
              and exists (select 1 from public.clientes c where c.id = cliente_id));
drop policy if exists "atendimentos: excluir" on public.atendimentos;
create policy "atendimentos: excluir" on public.atendimentos for delete to authenticated using (public.is_gestor());
grant select, insert, delete on public.atendimentos to authenticated;

-- anotações automáticas: cadastro, mudança de etapa e transferência
create or replace function public.clientes_historico()
returns trigger language plpgsql security definer set search_path = public as $$
declare quem text; de text; para text;
  nomes constant jsonb := '{"novo":"Novo contato","atendimento":"Em atendimento","visita":"Visita agendada","proposta":"Proposta","fechado":"Fechado","perdido":"Perdido"}';
begin
  select coalesce(nome, email) into quem from public.admins where user_id = auth.uid();
  if tg_op = 'INSERT' then
    if new.origem = 'site' then return new; end if;  -- registrado por lead_do_site
    insert into public.atendimentos (cliente_id, autor_id, tipo, texto)
    values (new.id, auth.uid(), 'sistema', 'Cliente cadastrado' || coalesce(' por ' || quem, '') || '.');
    return new;
  end if;
  if new.etapa is distinct from old.etapa then
    insert into public.atendimentos (cliente_id, autor_id, tipo, texto)
    values (new.id, auth.uid(), 'sistema', 'Etapa: ' || (nomes ->> old.etapa) || ' → ' || (nomes ->> new.etapa)
            || case when new.etapa = 'perdido' and new.motivo_perda is not null then ' (motivo: ' || new.motivo_perda || ')' else '' end || '.');
  end if;
  if new.corretor_id is distinct from old.corretor_id then
    select coalesce(nome, email) into de from public.admins where user_id = old.corretor_id;
    select coalesce(nome, email) into para from public.admins where user_id = new.corretor_id;
    insert into public.atendimentos (cliente_id, autor_id, tipo, texto)
    values (new.id, auth.uid(), 'sistema', case when old.corretor_id is null then 'Distribuído para ' || coalesce(para, '?')
            else 'Transferido de ' || coalesce(de, 'sem corretor') || ' para ' || coalesce(para, 'sem corretor') end
            || coalesce(' por ' || quem, '') || '.');
  end if;
  return new;
end $$;
drop trigger if exists clientes_historico on public.clientes;
create trigger clientes_historico after insert or update on public.clientes
  for each row execute function public.clientes_historico();

-- ---------- configuração da distribuição ----------
create table if not exists public.crm_config (
  id          smallint primary key default 1 check (id = 1),
  rodizio     boolean not null default true,     -- true: rodízio automático; false: o gestor distribui manualmente
  updated_at  timestamptz not null default now()
);
insert into public.crm_config (id) values (1) on conflict (id) do nothing;
alter table public.crm_config enable row level security;
drop policy if exists "config: membros leem" on public.crm_config;
create policy "config: membros leem" on public.crm_config for select to authenticated using (public.is_admin());
drop policy if exists "config: gestor altera" on public.crm_config;
create policy "config: gestor altera" on public.crm_config for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
grant select, update on public.crm_config to authenticated;

-- ---------- contatos vindos do site ----------
create or replace function public.lead_do_site(p_nome text, p_whatsapp text, p_interesse text, p_detalhes jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare d text := public.fone_digitos(p_whatsapp); c public.clientes; corretor uuid; txt text; i text;
begin
  i := case lower(coalesce(p_interesse, '')) when 'compra' then 'comprar' when 'locação' then 'alugar' when 'locacao' then 'alugar'
         when 'investimento' then 'investir' when 'administração de imóvel para locação' then 'anunciar' else 'comprar' end;
  if length(btrim(coalesce(p_nome, ''))) not between 2 and 120 or length(d) not in (10, 11)
     or pg_column_size(coalesce(p_detalhes, '{}'::jsonb)) > 4000 then
    return;                                                   -- dados inválidos: ignora em silêncio
  end if;
  select string_agg(k || ': ' || v, E'\n') into txt from jsonb_each_text(coalesce(p_detalhes, '{}'::jsonb)) as t(k, v);
  txt := 'Contato pelo site (' || coalesce(p_interesse, 'Atendimento') || ')' || coalesce(E'\n' || txt, '');
  select * into c from public.clientes where whatsapp = d;
  if found then
    -- já é cliente: não duplica nem troca o corretor; só anota (no máximo 1 vez a cada 10 minutos)
    if not exists (select 1 from public.atendimentos where cliente_id = c.id and tipo = 'site' and created_at > now() - interval '10 minutes') then
      insert into public.atendimentos (cliente_id, autor_id, tipo, texto) values (c.id, null, 'site', left(txt, 4000));
    end if;
    return;
  end if;
  if (select rodizio from public.crm_config where id = 1) then
    select user_id into corretor from public.admins
      where ativo and recebe_rodizio order by ultimo_lead_em nulls first, nome limit 1 for update skip locked;
    if corretor is not null then update public.admins set ultimo_lead_em = now() where user_id = corretor; end if;
  end if;
  insert into public.clientes (nome, whatsapp, interesse, faixa_valor, regiao, corretor_id, origem, etapa)
  values (btrim(p_nome), d, i, left(coalesce(p_detalhes ->> 'Faixa de valor', p_detalhes ->> 'Valor a investir'), 80),
          left(coalesce(p_detalhes ->> 'Região', p_detalhes ->> 'Cidade do imóvel'), 120), corretor, 'site', 'novo')
  returning * into c;
  insert into public.atendimentos (cliente_id, autor_id, tipo, texto) values (c.id, null, 'site', left(txt, 4000));
  if corretor is not null then
    insert into public.atendimentos (cliente_id, autor_id, tipo, texto)
    values (c.id, null, 'sistema', 'Distribuído por rodízio para ' || (select coalesce(nome, email) from public.admins where user_id = corretor) || '.');
  end if;
end $$;
revoke all on function public.lead_do_site(text, text, text, jsonb) from public;
grant execute on function public.lead_do_site(text, text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

-- ===================== Ocultar nº do apartamento (atualização 5) =====================
-- =====================================================================
-- Guarita Imobiliária: atualização 5 (ocultar o número do apartamento)
-- Execute UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Não apaga dados. Os imóveis já cadastrados continuam mostrando a unidade;
-- os novos vêm com a unidade oculta (o botão no painel muda isso).
--
-- Proteção real: o site público deixa de ler a tabela de imóveis e passa a
-- ler a "vitrine" imoveis_site, que entrega a unidade vazia quando ela está
-- oculta. Só quem está logado no painel lê a tabela completa.
-- =====================================================================

-- campos que a vitrine usa (caso alguma atualização anterior não tenha sido rodada)
alter table public.imoveis add column if not exists oportunidade boolean not null default false;
alter table public.imoveis add column if not exists valor_anterior numeric(14, 2);

alter table public.imoveis add column if not exists ocultar_unidade boolean not null default false;  -- existentes: visível
alter table public.imoveis alter column ocultar_unidade set default true;                            -- novos: oculta

-- vitrine pública: só anúncios publicados, com a unidade vazia quando oculta
drop view if exists public.imoveis_site;
create view public.imoveis_site as
  select id, slug, codigo, nome, tipo,
         case when ocultar_unidade then null else complemento end as complemento,
         ocultar_unidade, finalidade, endereco, bairro, cidade, estado,
         valor, valor_anterior, oportunidade, area_privativa, area_total,
         dormitorios, suites, banheiros, vagas, descricao, caracteristicas, info_complementar,
         status, publicado, destaque, ordem, fotos, created_at, updated_at
  from public.imoveis
  where publicado = true;
grant select on public.imoveis_site to anon, authenticated;

-- a tabela completa passa a ser lida só pelo painel (gestores e corretores logados)
drop policy if exists "imoveis: público lê publicados" on public.imoveis;
drop policy if exists "imoveis: painel lê" on public.imoveis;
create policy "imoveis: painel lê" on public.imoveis
  for select to authenticated using (public.is_admin());
revoke select on public.imoveis from anon;

notify pgrst, 'reload schema';
