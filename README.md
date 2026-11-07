# Guarita Imobiliária: site

Site institucional de página única da Guarita Imobiliária.

```
index.html                      página (HTML, CSS e JS no mesmo arquivo)
assets/img/                     imagens otimizadas (WebP em vários tamanhos)
dist/guarita-site-completo.html versão em arquivo único, com as imagens embutidas
tools/build_single.py           gera a versão em arquivo único
```

## Publicar
- **Com pasta de arquivos** (recomendado, carrega mais rápido): envie `index.html` e a pasta `assets/` para a hospedagem.
- **Arquivo único**: use `dist/guarita-site-completo.html`. Depois de editar o `index.html`, gere de novo com
  `python3 tools/build_single.py`.

## Configuração
Tudo fica no bloco `CONFIG` no fim do `index.html`:

| Campo | Uso |
|---|---|
| `whatsapp` | Número que recebe os contatos (DDI+DDD+número, só dígitos). |
| `email` | E-mail da imobiliária exibido no rodapé. O visitante **nunca** informa e-mail. |
| `instagram`, `creci` | Contatos exibidos no site. |
| `leadCopyEndpoint` | Cópia opcional de cada contato para a caixa de e-mail da imobiliária via FormSubmit. Deixe `''` para desativar. |

### Como os contatos chegam
Cada aba (Comprar, Investir, Alugar, Anunciar meu imóvel) pede só nome, WhatsApp e as informações da intenção escolhida.
Ao enviar, o site abre a conversa no WhatsApp da Guarita com a mensagem já preenchida e identificada
(`Interesse: Compra`, `Investimento`, `Locação` ou `Administração de imóvel para locação`).

Se `leadCopyEndpoint` estiver ativo, uma cópia vai para `imobiliariaguarita@hotmail.com`. Na primeira vez, o
FormSubmit manda um e-mail de ativação para esse endereço; a cópia só começa a chegar depois que alguém clicar no link.
O contato pelo WhatsApp funciona com ou sem essa ativação.

## Imóveis
A vitrine (`#imoveis`) mostra os imóveis cadastrados. Para incluir um novo, copie o bloco `<article class="prop">`,
troque os dados e coloque as fotos em `assets/img/imovel/<nome>/` seguindo o padrão `01-720.webp`, `01-1280.webp`
e `01-t-200.webp`. Os atributos `data-gal` e `data-fotos` ligam o cartão à galeria.

## Créditos das fotos
As fotos das regiões e da abertura vêm do Wikimedia Commons, com licenças CC BY / CC BY-SA. Os créditos ficam
no rodapé ("Créditos das fotografias") e precisam continuar lá. As fotos do imóvel, da roda-gigante e do
fundador são do acervo da Guarita.
