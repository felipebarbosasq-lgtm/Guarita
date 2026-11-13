# Guarita Imobiliária: site

Site da Guarita Imobiliária com cadastro de imóveis pelo painel `/admin`, sem precisar editar HTML.

- **Site público:** HTML5, CSS3 e JavaScript, sem framework. Funciona aberto direto do disco (modo demonstração) ou publicado.
- **Banco de dados, login e fotos:** [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage), com regras de segurança no próprio banco.
- **Hospedagem:** [Netlify](https://netlify.com), com HTTPS, domínio próprio, sitemap automático e metadados de cada imóvel.

---

## 1. Estrutura

```
ABRIR-VISUALIZACAO.html        atalho: abre o site no navegador, sem servidor
public/                        TUDO o que vai para o ar (pasta publicada pelo Netlify)
  index.html                   página inicial
  imovel/index.html            página individual de imóvel (uma só para todos: /imovel/<nome-do-imovel>)
  admin/index.html             painel administrativo (não aparece no menu do site)
  robots.txt
  assets/css/site.css          estilos do site
  assets/css/admin.css         estilos do painel
  assets/css/fonts-inline.css  fontes embutidas, usadas só ao abrir o site direto do disco
  assets/js/config.js          CONFIGURAÇÃO (WhatsApp, e-mail, Instagram, CRECI; o banco é preenchido no build)
  assets/js/core.js            funções comuns: cartão do imóvel, formatação, leitura do banco
  assets/js/home.js            banner, carrossel de imóveis, abas e formulários
  assets/js/imovel.js          página do imóvel e galeria
  assets/js/admin.js           painel: login, cadastro, fotos, ordem, publicação
  assets/js/demo-data.js       imóvel de demonstração (Eleganza Tower) para uso sem banco
  assets/vendor/               biblioteca oficial do Supabase (supabase-js 2.119.0, licença MIT)
  assets/fonts/                Cormorant Garamond e Jost (WOFF2) + licenças SIL OFL 1.1
  assets/img/hero/             4 paisagens do banner (computador e celular)
  assets/img/imovel/eleganza/  14 fotos do Eleganza Tower
  assets/img/regioes/          fotos das regiões
  assets/img/site/             logomarca, foto do fundador, imagem de compartilhamento
supabase/schema.sql            tabelas, regras de segurança (RLS) e bucket de fotos
supabase/seed.sql              cadastra o Eleganza Tower + modelo para autorizar administradores
netlify.toml                   build, redirecionamentos e cabeçalhos de segurança
netlify/functions/sitemap.mjs  /sitemap.xml com os imóveis publicados
netlify/edge-functions/        título, descrição e foto de cada imóvel para Google e WhatsApp
netlify/shared/meta.mjs        funções usadas pelas duas acima
.env.example                   exemplo das variáveis de ambiente (sem senhas)
tools/build-config.mjs         roda no Netlify: copia as variáveis para config.js e gera robots.txt
tools/preview.mjs              servidor local com as rotas do Netlify
tools/hero_images.py           gera as versões das fotos do banner a partir dos originais
tools/build_inline_fonts.py    gera fonts-inline.css
tools/make_zip.py              gera o ZIP de entrega
tests/                         testes automáticos (banco, segurança, navegador)
```

## 2. Ver o site no computador

**Sem instalar nada:** abra `ABRIR-VISUALIZACAO.html` (ou `public/index.html`) no navegador. Funciona o layout completo,
o banner, o imóvel de demonstração, a página do imóvel, a galeria e os formulários (que abrem o WhatsApp).
O painel `/admin` precisa do banco configurado (seção 3).

**Com as mesmas rotas do site publicado** (opcional, requer [Node.js](https://nodejs.org) 20+):

```
node tools/preview.mjs
```
e acesse http://localhost:8080.

## 3. Publicar (Supabase + Netlify + domínio próprio)

### 3.1 Banco de dados (Supabase, plano gratuito serve)
1. Crie uma conta em supabase.com e um projeto novo (região **South America (São Paulo)**). Guarde a senha do banco.
2. No projeto: **SQL Editor > New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Nova query com o conteúdo de `supabase/seed.sql` e **Run** (cadastra o Eleganza Tower).
4. **Authentication > Sign In / Providers > Email**: desative **Allow new users to sign up**
   (só quem você criar poderá entrar).
5. **Authentication > Users > Add user > Create new user**: e-mail e senha de cada pessoa que vai usar o painel
   (marque *Auto Confirm User*). Use senhas fortes e individuais.
6. Autorize cada pessoa no **SQL Editor** (troque o e-mail):
   ```sql
   insert into public.admins (user_id, email, nome)
   select id, email, 'Nome da pessoa' from auth.users where email = 'pessoa@exemplo.com.br'
   on conflict (user_id) do nothing;
   ```
   Para tirar o acesso: `delete from public.admins where email = 'pessoa@exemplo.com.br';`
7. **Project Settings > API**: copie a **Project URL** e a chave **anon public**.
   A chave **service_role** é secreta e **não** é usada pelo site; nunca a coloque no código nem no Netlify.

### 3.2 Hospedagem (Netlify)
**Recomendado: pelo GitHub** (o Netlify publica sozinho a cada alteração).
1. netlify.com > **Add new site > Import an existing project > GitHub** e escolha este repositório.
   As configurações (`publish = public`, comando de build, funções) já vêm do `netlify.toml`.
2. **Site configuration > Environment variables**, crie (modelo em `.env.example`):
   | Variável | Valor |
   |---|---|
   | `SUPABASE_URL` | Project URL do Supabase |
   | `SUPABASE_ANON_KEY` | chave *anon public* |
   | `SUPABASE_BUCKET` | `imoveis` |
   | `SITE_URL` | endereço final, ex.: `https://www.seudominio.com.br` |
3. **Deploys > Trigger deploy > Deploy site**. No log deve aparecer `config.js atualizado: banco conectado`.

**Sem GitHub (upload do ZIP):** extraia o ZIP e rode, na pasta do projeto, com o [Netlify CLI](https://docs.netlify.com/cli/get-started/):
```
npm install -g netlify-cli
netlify login
netlify init                      # cria o site
netlify env:set SUPABASE_URL "https://SEU-PROJETO.supabase.co"
netlify env:set SUPABASE_ANON_KEY "sua-chave-anon"
netlify env:set SITE_URL "https://www.seudominio.com.br"
netlify deploy --build --prod
```
Arrastar só a pasta `public` para o Netlify Drop também publica o site, mas sem build: nesse caso preencha
`supabaseUrl`, `supabaseAnonKey`, `siteUrl` e `prettyUrls: true` direto em `public/assets/js/config.js`,
e saiba que o sitemap automático e os metadados por imóvel (funções) não serão publicados.

### 3.3 Conectar o painel ao endereço do site
No Supabase, **Authentication > URL Configuration**: em **Site URL** coloque o endereço do site e em
**Redirect URLs** adicione `https://www.seudominio.com.br/admin/` (necessário para o link de "Esqueci minha senha").

### 3.4 Domínio próprio e HTTPS
1. Netlify: **Domain management > Add a domain** e digite o domínio (ex.: `seudominio.com.br`).
2. No registro do domínio (Registro.br, por exemplo), use os **DNS do Netlify** que aparecem na tela
   (ou crie os registros `A`/`CNAME` indicados por ele).
3. Quando o domínio estiver ativo, o Netlify emite o certificado **HTTPS** sozinho (Let's Encrypt).
   Em **HTTPS** confirme que está *Enabled*; o site força HTTPS e envia HSTS (cabeçalho em `netlify.toml`).
4. Atualize `SITE_URL` no Netlify e as URLs do item 3.3 com o domínio definitivo, e faça um novo deploy.
5. Envie `https://www.seudominio.com.br/sitemap.xml` no Google Search Console.

### 3.5 Redirecionamentos (já configurados em `netlify.toml`)
- `/imovel/<nome-do-imovel>` usa a página `imovel/index.html` (endereço amigável de cada anúncio).
- `/admin` vai para `/admin/`.
- `/sitemap.xml` é gerado na hora com os imóveis publicados.
Para redirecionar endereços antigos, acrescente blocos `[[redirects]]` no `netlify.toml`.

### 3.6 Atualizações do banco
Quando uma novidade precisar de campos novos no banco, ela vem num arquivo `supabase/atualizacao-NN-*.sql`.
Rode cada um **uma vez**, em ordem, no **SQL Editor** do Supabase (*New query > colar > Run*). Eles não apagam dados.
- `atualizacao-02-oportunidade.sql`: selo Oportunidade e preço "de/por".
Quem instala do zero só precisa do `schema.sql` (já inclui todas as atualizações) e do `seed.sql`.

### 3.7 Publicar atualizações futuras
- **Imóveis:** pelo painel. Não é preciso republicar o site: as mudanças aparecem na hora.
- **Textos, telefones, design:** edite os arquivos, faça *commit* no GitHub (o Netlify publica sozinho)
  ou rode `netlify deploy --build --prod`. WhatsApp, e-mail, Instagram e CRECI ficam em `public/assets/js/config.js`.
- O banco e as fotos ficam no Supabase e **não** são afetados por novas publicações.

## 4. Painel administrativo (`/admin/`)
- Login com e-mail e senha individuais; "Esqueci minha senha" envia um link de redefinição.
- **Lista:** pesquisa por nome, cidade, bairro ou código; filtro (publicados, não publicados, destaque);
  botões para **publicar/despublicar**, **destaque**, **reordenar** (setas ou arrastar pela alça ⋮⋮), ver, editar e excluir.
  A ordem da lista é a ordem do carrossel; imóveis em destaque aparecem primeiro.
- **Cadastro/edição:** nome, código (gerado automaticamente, ex.: GUA-0002, ou digitado), tipo, unidade,
  venda/locação, disponibilidade, endereço, bairro, cidade, estado, valor, áreas, dormitórios, suítes, banheiros,
  vagas, descrição, características (uma por linha), informações complementares, publicação, destaque e endereço da página.
  A pré-visualização mostra o cartão exatamente como aparecerá no site.
- **Fotos:** selecione ou arraste várias de uma vez (JPG, PNG, WebP, HEIC; até 30 MB; mínimo 800 px no lado maior).
  O painel valida, corrige a rotação, reduz para 1920 px, 960 px e miniatura de 400 px em WebP, envia ao Supabase e
  monta a galeria. Nunca corta, estica ou amplia. A primeira foto é a capa (★ escolhe outra; setas ou arrastar mudam a ordem).
- **Oportunidade:** ligue "Oportunidade" no imóvel (ou o botão *Oportunidade* na lista) para mostrar no site uma
  faixa dourada com a palavra **OPORTUNIDADE** em preto, com um pulso discreto. Para mostrar desconto, preencha
  **Valor anterior "de"**: o site exibe ~~De R$ 470.000,00~~ **Por R$ 350.000,00** (o "de" precisa ser maior que o valor atual).
- **Excluir** pede confirmação e apaga também as fotos enviadas.
- Formatação automática para todos os anúncios: R$ 1.234.567,00, áreas em m², singular/plural, mesmo cartão e mesma página.

## 5. Segurança
- O navegador só recebe a chave **anon** do Supabase, que é pública por natureza. O que ela pode fazer é limitado pelas
  regras **RLS** de `supabase/schema.sql`: visitantes leem apenas imóveis publicados; cadastrar, editar, excluir,
  reordenar e enviar fotos exige login de alguém que esteja na tabela `admins`. Isso é verificado pelo banco,
  então não adianta alterar o JavaScript no navegador.
- O banco também valida os dados (valores não negativos, suítes ≤ dormitórios, endereço da página válido, etc.).
- `/admin/` não é indexado (`noindex`, `robots.txt`), não pode ser aberto dentro de outros sites e tem política de conteúdo restrita.
- Nenhuma senha ou chave privada fica no código. `.env` está no `.gitignore`.

## 6. Banner e créditos das fotografias
O banner tem 3 fotos de Balneário Camboriú enviadas pela Guarita (Barra Sul e marina, Praia Central com a
roda-gigante e entardecer na Barra Sul). Os originais tinham entre 720 e 1200 px; foram ampliados 4 vezes com
inteligência artificial (Real-ESRGAN, `tools/ampliar_fotos.py`) e misturados a 20% de uma ampliação tradicional
para manter a textura natural. Depois, `tools/hero_images.py` cria versões de 1280 a 3840 px para computador e um
recorte vertical (9:16) para celular, sem bordas pretas e sem deformar.

**Direitos de uso:** confirme que a Guarita tem autorização para usar comercialmente essas três fotos (se vieram da
internet, o autor precisa autorizar).

Para trocar as fotos: amplie com `tools/ampliar_fotos.py` (instruções no início do arquivo), salve como
`1.jpg`, `2.jpg`… numa pasta, ajuste a lista `HERO` em `tools/hero_images.py` e rode
`python3 tools/hero_images.py PASTA`. O script atualiza o HTML e os créditos.

Fotos das regiões: Wikimedia Commons (créditos no rodapé). Fotos do Eleganza Tower, roda-gigante e fundador: acervo da Guarita.
Fontes: Cormorant Garamond e Jost, SIL Open Font License 1.1 (arquivos em `public/assets/fonts`).

## 7. Formulários de atendimento
Abas **Comprar | Alugar | Anunciar meu imóvel**. Cada uma valida os dados e abre a conversa no WhatsApp da Guarita
com a mensagem pronta (o visitante nunca informa e-mail). Se `leadCopyEndpoint` estiver ativo em `config.js`, uma
cópia vai para `imobiliariaguarita@hotmail.com` via FormSubmit; na primeira vez o FormSubmit manda um e-mail de
ativação que precisa ser confirmado.

## 8. Testes
`npm test` (Linux com PostgreSQL 16 e Playwright) roda:
- `tests/local-supabase/rls-test.sql`: regras de segurança no PostgreSQL real (visitante, usuário sem permissão, administrador);
- `tests/e2e.mjs`: site aberto do disco, rotas do Netlify, painel (login, cadastro com fotos, validações, reordenar,
  publicar, excluir), carrossel (automático, arrastar, setas, touchpad, pausa e retomada, loop), banner, formulários e
  responsividade em 1920, 4K, 1366, iPad, iPhone, Android e 360 px.
O servidor `tests/local-supabase/server.mjs` simula a API do Supabase só para os testes; não é usado em produção.

## 9. Pendências (informações que não estavam no site original)
- **Eleganza Tower:** descrição, banheiros e área total não estavam publicados; ficaram em branco para serem
  preenchidos no painel. O código **GUA-0001** foi atribuído pelo sistema (pode ser alterado no painel).
- **Configuração externa:** o painel só funciona depois de criar o projeto no Supabase e definir as variáveis no Netlify (seção 3).
