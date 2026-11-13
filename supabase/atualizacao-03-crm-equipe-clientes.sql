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
