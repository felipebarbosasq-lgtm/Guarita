-- DOM Web: estrutura do banco (Supabase / PostgreSQL)
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run.
-- Depois rode supabase/seed.sql (gerado com: npm run seed-sql) para carregar o cardápio.

-- Cardápio e configurações da loja: um único documento JSON (loja, bairros, categorias, produtos).
create table if not exists public.cardapio (
  id int primary key default 1 check (id = 1),
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- Cupons ficam separados para não serem visíveis ao público.
create table if not exists public.cupons (
  id text primary key,
  codigo text not null unique,
  tipo text not null check (tipo in ('percentual', 'valor')),
  valor numeric(10,2) not null check (valor >= 0),
  minimo numeric(10,2) not null default 0,
  ativo boolean not null default true
);

create sequence if not exists public.pedidos_numero_seq start 1001;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique default nextval('public.pedidos_numero_seq'),
  criado_em timestamptz not null default now(),
  status text not null default 'novo' check (status in ('novo','preparo','pronto','entrega','concluido','cancelado')),
  origem text not null default 'cardapio',
  tipo text not null check (tipo in ('entrega','retirada','mesa','balcao')),
  mesa text,
  cliente jsonb not null default '{}',
  endereco jsonb,
  itens jsonb not null,
  subtotal numeric(10,2) not null,
  taxa_entrega numeric(10,2) not null default 0,
  desconto numeric(10,2) not null default 0,
  cupom text,
  total numeric(10,2) not null,
  pagamento text,
  troco_para numeric(10,2),
  obs text,
  historico jsonb not null default '[]'
);
create index if not exists pedidos_criado_em_idx on public.pedidos (criado_em desc);
create index if not exists pedidos_telefone_idx on public.pedidos ((cliente->>'telefone'));


-- ---------- Segurança (RLS) ----------
-- Público: só lê o cardápio. Pedidos são criados pela função do servidor (que recalcula os preços).
-- Painel: qualquer usuário logado no Supabase Auth é dono da loja.
-- IMPORTANTE: em Authentication > Providers > Email, DESLIGUE "Allow new users to sign up"
-- e crie o seu usuário em Authentication > Users > Add user.

alter table public.cardapio enable row level security;
alter table public.cupons enable row level security;
alter table public.pedidos enable row level security;

drop policy if exists cardapio_ler on public.cardapio;
create policy cardapio_ler on public.cardapio for select using (true);
drop policy if exists cardapio_editar on public.cardapio;
create policy cardapio_editar on public.cardapio for update to authenticated using (true) with check (true);

drop policy if exists cupons_admin on public.cupons;
create policy cupons_admin on public.cupons for all to authenticated using (true) with check (true);

drop policy if exists pedidos_admin on public.pedidos;
create policy pedidos_admin on public.pedidos for all to authenticated using (true) with check (true);

grant usage, select on sequence public.pedidos_numero_seq to authenticated, service_role;

-- ---------- Fotos ----------
insert into storage.buckets (id, name, public)
values ('imagens', 'imagens', true)
on conflict (id) do nothing;

drop policy if exists imagens_ler on storage.objects;
create policy imagens_ler on storage.objects for select using (bucket_id = 'imagens');
drop policy if exists imagens_enviar on storage.objects;
create policy imagens_enviar on storage.objects for insert to authenticated with check (bucket_id = 'imagens');
drop policy if exists imagens_apagar on storage.objects;
create policy imagens_apagar on storage.objects for delete to authenticated using (bucket_id = 'imagens');

-- ---------- Atendente de WhatsApp com IA ----------
-- Guarda as últimas mensagens de cada cliente para a IA lembrar da conversa.
create table if not exists public.conversas (
  telefone text primary key,
  nome text,
  mensagens jsonb not null default '[]',
  ultimo_id text,
  atualizado_em timestamptz not null default now()
);
alter table public.conversas enable row level security;
drop policy if exists conversas_admin on public.conversas;
create policy conversas_admin on public.conversas for select to authenticated using (true);
