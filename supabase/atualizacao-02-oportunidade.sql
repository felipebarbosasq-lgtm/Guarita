-- =====================================================================
-- Guarita Imobiliária: atualização 2 (selo "Oportunidade" e preço "de/por")
-- Execute UMA vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Não apaga nem altera os imóveis já cadastrados. Pode ser executado de novo sem problema.
-- =====================================================================
alter table public.imoveis add column if not exists oportunidade boolean not null default false;
alter table public.imoveis add column if not exists valor_anterior numeric(14, 2);
alter table public.imoveis drop constraint if exists valor_anterior_maior;
alter table public.imoveis add constraint valor_anterior_maior
  check (valor_anterior is null or (valor_anterior > 0 and (valor is null or valor_anterior > valor)));
notify pgrst, 'reload schema';
