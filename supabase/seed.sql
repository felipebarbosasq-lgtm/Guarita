-- =====================================================================
-- Guarita Imobiliária: dados iniciais
-- Execute DEPOIS de schema.sql. Cadastra o imóvel que já estava no site
-- (Eleganza Tower, apartamento 4200), com as fotos que acompanham o site
-- em /assets/img/imovel/eleganza. Não altera nada se ele já existir.
-- Informações que não estavam publicadas no site original (descrição,
-- banheiros, área total) ficam em branco para serem preenchidas no painel.
-- =====================================================================
insert into public.imoveis
  (slug, codigo, nome, tipo, complemento, finalidade, endereco, bairro, cidade, estado,
   valor, area_privativa, dormitorios, suites, vagas, status, publicado, destaque, ordem, fotos, ocultar_unidade)
select 'eleganza-tower-apartamento-4200', 'GUA-0001', 'Eleganza Tower', 'Apartamento', '4200', 'venda',
  'Rua 1101, 140', 'Centro', 'Balneário Camboriú', 'SC', 7519000.00, 140, 4, 2, 3, 'disponivel', true, true, 1,
  jsonb_agg(jsonb_build_object(
    'lg', format('assets/img/imovel/eleganza/%s-1280.webp', lpad(n::text, 2, '0')),
    'md', format('assets/img/imovel/eleganza/%s-720.webp', lpad(n::text, 2, '0')),
    'th', format('assets/img/imovel/eleganza/%s-t-200.webp', lpad(n::text, 2, '0')),
    'w', 1280,
    'h', (array[856,854,854,854,854,854,856,854,856,854,854,855,854,849])[n],
    'alt', case when n = 1 then 'Sala de jantar integrada com vista panorâmica para o mar, apartamento 4200 do Eleganza Tower' else '' end
  ) order by n),
  false  -- o site original mostrava "Apartamento 4200"
from generate_series(1, 14) as n
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Administradores: crie o usuário em Authentication > Users > Add user
-- (e-mail e senha individuais) e depois autorize-o aqui, trocando o e-mail:
--
--   insert into public.admins (user_id, email, nome, papel, recebe_rodizio)
--   select id, email, 'Nome da pessoa', 'gestor', false from auth.users where email = 'pessoa@exemplo.com.br'
--   on conflict (user_id) do nothing;
--
-- Depois disso, os demais (gestores e corretores) são cadastrados pelo próprio painel, na aba Equipe.
--
-- Para remover o acesso de alguém:
--   delete from public.admins where email = 'pessoa@exemplo.com.br';
-- ---------------------------------------------------------------------
