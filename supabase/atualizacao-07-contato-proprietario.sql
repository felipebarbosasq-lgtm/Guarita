-- =====================================================================
-- Guarita Imobiliária: atualização 7 (contato do dono/responsável do imóvel)
-- Execute UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Não apaga dados. Inclui as atualizações 5 e 6 (vitrine do site e
-- "Origem do imóvel"), então serve mesmo para quem ainda não rodou essas.
--
-- Nome, telefone e tipo do contato ficam só na tabela completa, que apenas
-- a equipe logada lê; a vitrine pública imoveis_site não tem essas colunas.
-- =====================================================================
alter table public.imoveis add column if not exists proprietario_nome text;
alter table public.imoveis add column if not exists proprietario_telefone text;
alter table public.imoveis add column if not exists proprietario_tipo text;
alter table public.imoveis drop constraint if exists proprietario_ok;
alter table public.imoveis add constraint proprietario_ok check (
  (proprietario_nome is null or length(proprietario_nome) <= 120)
  and (proprietario_telefone is null or proprietario_telefone ~ '^[0-9]{10,13}$')
  and (proprietario_tipo is null or proprietario_tipo in ('proprietario', 'responsavel', 'corretor', 'construtora', 'outro')));

alter table public.imoveis add column if not exists origem_captacao text;
alter table public.imoveis drop constraint if exists origem_captacao_tamanho;
alter table public.imoveis add constraint origem_captacao_tamanho check (origem_captacao is null or length(origem_captacao) <= 4000);

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
