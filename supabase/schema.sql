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
