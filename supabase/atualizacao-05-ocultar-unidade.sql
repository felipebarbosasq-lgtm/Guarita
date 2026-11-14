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
