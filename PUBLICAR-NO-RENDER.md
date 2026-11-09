# Como publicar o Guarita Mob no Render

O projeto já tem o arquivo `render.yaml`. O Render lê esse arquivo e cria tudo sozinho:
o servidor, o disco onde fica o banco de dados e as configurações.

**Custo:** o plano **Starter** custa cerca de **US$ 7 por mês**, mais cerca de **US$ 0,25 por mês** pelo disco de 1 GB.
O plano gratuito não serve, porque não tem disco permanente: os dados seriam apagados a cada atualização.
Confira os valores atuais em render.com/pricing.

## 1. Criar a conta no Render

1. Acesse **render.com** e clique em **Get Started**.
2. Escolha **entrar com o GitHub** e use a conta dona do repositório `Guarita`.
3. Quando o Render pedir acesso aos repositórios, libere o repositório **Guarita**.

## 2. Criar o sistema a partir do `render.yaml`

1. No painel do Render, clique em **New +** e depois em **Blueprint**.
2. Escolha o repositório **felipebarbosasq-lgtm/Guarita**.
3. No campo do branch, escolha **`claude/lucid-brown-ygd7o8`**.
   Esse branch é importante: é onde está o sistema completo.
4. O Render mostra o que vai criar: o serviço **guarita-mob** com o disco **dados**. Clique em **Apply** (ou **Deploy Blueprint**).
5. Cadastre um cartão quando o Render pedir. O plano Starter é pago.

A primeira publicação leva alguns minutos. Quando aparecer **Live** em verde, está no ar.
O endereço aparece no topo da página do serviço, algo como `https://guarita-mob.onrender.com`.

## 3. Criar a sua imobiliária

1. Abra o endereço do sistema e acrescente **`/cadastro`** no final. Exemplo: `https://guarita-mob.onrender.com/cadastro`.
2. Preencha o nome da imobiliária, o seu nome, e-mail e senha.
3. Você entra direto no sistema como **administrador**.

O site público da sua imobiliária fica em `/s/<nome-da-imobiliaria>`.
O endereço exato aparece no botão **Meu site** no canto inferior do menu.

## 4. Fechar o cadastro (recomendado)

Enquanto o cadastro estiver aberto, qualquer pessoa que achar o endereço pode criar uma imobiliária no seu servidor.
Depois de criar a sua conta, feche o cadastro:

- **Jeito mais fácil:** peça ao Claude para mudar `ALLOW_SIGNUP` para `0` no `render.yaml`. O Render publica sozinho.
- **Pelo painel:** abra o serviço **guarita-mob**, vá em **Environment**, mude `ALLOW_SIGNUP` para `0` e salve.

Se um dia quiser vender o sistema para outras imobiliárias, basta deixar o cadastro aberto.

## 5. Cadastrar a equipe

No sistema, vá em **Administração → Equipe e permissões**, clique em **+ Usuário**, escolha o papel e defina uma senha.
Depois envie o endereço, o e-mail e a senha para a pessoa. Ela pode trocar a senha em **Minha senha**.

## Dia a dia

- **Atualizações:** toda vez que uma alteração for enviada para o branch `claude/lucid-brown-ygd7o8`, o Render publica a nova versão sozinho.
  Durante a publicação, o sistema fica fora do ar por alguns segundos.
- **Backup:**
  - O Render guarda cópias diárias do disco por alguns dias.
  - Além disso, de tempos em tempos vá em **Configurações → Importar e exportar → Exportar tudo** e guarde o arquivo.
- **Domínio próprio** (ex.: `sistema.suaimobiliaria.com.br`): no serviço, vá em **Settings → Custom Domains**, adicione o domínio e siga as instruções de DNS. O Render cria o certificado HTTPS sozinho.
- **Se algo der errado:** a aba **Logs** do serviço mostra as mensagens do servidor. Copie e mande para o Claude.
