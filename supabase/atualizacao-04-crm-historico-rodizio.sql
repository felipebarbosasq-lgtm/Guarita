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
