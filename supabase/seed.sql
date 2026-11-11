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
   valor, area_privativa, dormitorios, suites, vagas, status, publicado, destaque, ordem, fotos)
values
  ('eleganza-tower-apartamento-4200', 'GUA-0001', 'Eleganza Tower', 'Apartamento', '4200', 'venda', 'Rua 1101, 140', 'Centro', 'Balneário Camboriú', 'SC',
   7519000.00, 140, 4, 2, 3, 'disponivel', true, true, 1,
   '[{"lg": "assets/img/imovel/eleganza/01-1280.webp", "md": "assets/img/imovel/eleganza/01-720.webp", "th": "assets/img/imovel/eleganza/01-t-200.webp", "w": 1280, "h": 856, "alt": "Sala de jantar integrada com vista panorâmica para o mar, apartamento 4200 do Eleganza Tower"}, {"lg": "assets/img/imovel/eleganza/02-1280.webp", "md": "assets/img/imovel/eleganza/02-720.webp", "th": "assets/img/imovel/eleganza/02-t-200.webp", "w": 1280, "h": 854, "alt": ""}, {"lg": "assets/img/imovel/eleganza/03-1280.webp", "md": "assets/img/imovel/eleganza/03-720.webp", "th": "assets/img/imovel/eleganza/03-t-200.webp", "w": 1280, "h": 854, "alt": ""}, {"lg": "assets/img/imovel/eleganza/04-1280.webp", "md": "assets/img/imovel/eleganza/04-720.webp", "th": "assets/img/imovel/eleganza/04-t-200.webp", "w": 1280, "h": 854, "alt": ""}, {"lg": "assets/img/imovel/eleganza/05-1280.webp", "md": "assets/img/imovel/eleganza/05-720.webp", "th": "assets/img/imovel/eleganza/05-t-200.webp", "w": 1280, "h": 854, "alt": ""}, {"lg": "assets/img/imovel/eleganza/06-1280.webp", "md": "assets/img/imovel/eleganza/06-720.webp", "th": "assets/img/imovel/eleganza/06-t-200.webp", "w": 1280, "h": 854, "alt": ""}, {"lg": "assets/img/imovel/eleganza/07-1280.webp", "md": "assets/img/imovel/eleganza/07-720.webp", "th": "assets/img/imovel/eleganza/07-t-200.webp", "w": 1280, "h": 856, "alt": ""}, {"lg": "assets/img/imovel/eleganza/08-1280.webp", "md": "assets/img/imovel/eleganza/08-720.webp", "th": "assets/img/imovel/eleganza/08-t-200.webp", "w": 1280, "h": 854, "alt": ""}, {"lg": "assets/img/imovel/eleganza/09-1280.webp", "md": "assets/img/imovel/eleganza/09-720.webp", "th": "assets/img/imovel/eleganza/09-t-200.webp", "w": 1280, "h": 856, "alt": ""}, {"lg": "assets/img/imovel/eleganza/10-1280.webp", "md": "assets/img/imovel/eleganza/10-720.webp", "th": "assets/img/imovel/eleganza/10-t-200.webp", "w": 1280, "h": 854, "alt": ""}, {"lg": "assets/img/imovel/eleganza/11-1280.webp", "md": "assets/img/imovel/eleganza/11-720.webp", "th": "assets/img/imovel/eleganza/11-t-200.webp", "w": 1280, "h": 854, "alt": ""}, {"lg": "assets/img/imovel/eleganza/12-1280.webp", "md": "assets/img/imovel/eleganza/12-720.webp", "th": "assets/img/imovel/eleganza/12-t-200.webp", "w": 1280, "h": 855, "alt": ""}, {"lg": "assets/img/imovel/eleganza/13-1280.webp", "md": "assets/img/imovel/eleganza/13-720.webp", "th": "assets/img/imovel/eleganza/13-t-200.webp", "w": 1280, "h": 854, "alt": ""}, {"lg": "assets/img/imovel/eleganza/14-1280.webp", "md": "assets/img/imovel/eleganza/14-720.webp", "th": "assets/img/imovel/eleganza/14-t-200.webp", "w": 1280, "h": 849, "alt": ""}]'::jsonb)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Administradores: crie o usuário em Authentication > Users > Add user
-- (e-mail e senha individuais) e depois autorize-o aqui, trocando o e-mail:
--
--   insert into public.admins (user_id, email, nome)
--   select id, email, 'Nome da pessoa' from auth.users where email = 'pessoa@exemplo.com.br'
--   on conflict (user_id) do nothing;
--
-- Para remover o acesso de alguém:
--   delete from public.admins where email = 'pessoa@exemplo.com.br';
-- ---------------------------------------------------------------------
