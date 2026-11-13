#!/usr/bin/env python3
"""Gera as fotos da abertura (banner) a partir dos originais e atualiza index.html.

Uso:  python3 tools/hero_images.py PASTA_DOS_ORIGINAIS
      (arquivos 1.jpg, 2.jpg, 3.jpg… na ordem de HERO abaixo, já ampliados; requer Pillow)

Para cada foto cria:
  - versões para computador (corte horizontal) em 1280, 1920, 2560 e 3840 px, até o tamanho do original
  - versões para celular (corte vertical 9:16 centrado no ponto de interesse) em 720 e 1080 px
Nunca amplia: só são geradas larguras menores ou iguais à do original/recorte.
"""
import os, re, sys, json
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/assets/img/hero')
HTML = [os.path.join(ROOT, 'public/index.html'), os.path.join(ROOT, 'public/imovel/index.html')]

# Ordem de exibição. "desk": proporção máxima do corte horizontal e foco vertical (0-1).
# "mob": foco horizontal (0-1) do corte vertical para celular. "pos": object-position no computador.
HERO = [
    # Fotos enviadas pela Guarita Imobiliária, ampliadas 4x com IA (Real-ESRGAN) por tools/ampliar_fotos.py.
    dict(slug='bc-barra-sul', title='Barra Sul e marina',
         alt='Vista aérea da Barra Sul de Balneário Camboriú, com a marina, o molhe e os arranha-céus à beira-mar',
         desk=(16 / 9, .5), mob=.63, pos='50% 50%', mpos='50% 50%'),
    dict(slug='bc-praia-central', title='Praia Central e roda-gigante',
         alt='Vista aérea da Praia Central de Balneário Camboriú, com a roda-gigante, o mar e a orla de edifícios',
         desk=(16 / 9, .5), mob=.60, pos='50% 50%', mpos='50% 50%'),
    dict(slug='bc-entardecer', title='Entardecer na Barra Sul',
         alt='Balneário Camboriú ao entardecer, com os arranha-céus, a roda-gigante e o molhe vistos do alto',
         desk=(16 / 9, .45), mob=.34, pos='50% 50%', mpos='50% 50%'),
]
DESK_W = [1280, 1920, 2560, 3840]
MOB_W = [720, 1080]


def crop_desk(im, ratio, fy):
    w, h = im.size
    if not ratio or w / h >= ratio:
        return im
    nh = round(w / ratio)
    top = min(max(0, round(fy * h - nh / 2)), h - nh)
    return im.crop((0, top, w, top + nh))


def crop_mob(im, fx):
    w, h = im.size
    nw = round(h * 9 / 16)
    left = min(max(0, round(fx * w - nw / 2)), w - nw)
    return im.crop((left, 0, left + nw, h))


def save(im, width, path, q):
    if width < im.width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(path, 'WEBP', quality=q, method=6)
    return im.size


def main(src):
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    meta = []
    for k, h in enumerate(HERO, 1):
        im = ImageOps.exif_transpose(Image.open(os.path.join(src, f'{k}.jpg'))).convert('RGB')
        d = crop_desk(im, *h['desk'])
        dw = [w for w in DESK_W if w <= d.width] or [d.width]
        if d.width not in dw and d.width < DESK_W[-1] and d.width > dw[-1]:
            dw.append(d.width)  # tamanho nativo quando o original fica entre dois degraus
        ds = [(w, save(d, w, f'{OUT}/{h["slug"]}-{w}.webp', 80)) for w in dw]
        m = crop_mob(im, h['mob'])
        mw = [w for w in MOB_W if w <= m.width] or [m.width]
        if m.width > mw[-1] and m.width < MOB_W[-1]:
            mw.append(m.width)
        ms = [(w, save(m, w, f'{OUT}/{h["slug"]}-m-{w}.webp', 78)) for w in mw]
        meta.append(dict(h, ds=ds, ms=ms))
        print(h['slug'], 'original', im.size, '-> desktop', [s for _, s in ds], 'celular', [s for _, s in ms])
    write_html(meta)


def write_html(meta):
    def ss(slug, lst, m=''):
        return ', '.join(f'assets/img/hero/{slug}{m}-{w}.webp {w}w' for w, _ in lst)
    slides, dots, credits = [], [], []
    for k, h in enumerate(meta):
        dw, (W, H) = h['ds'][-1][0], h['ds'][-1][1]
        mid = min(h['ds'], key=lambda x: abs(x[0] - 1920))
        first = k == 0
        slides.append(
            f''' <div class="slide{' on' if first else ''}" style="--pos:{h['pos']};--mpos:{h['mpos']}">
  <picture>
   <source media="(max-aspect-ratio: 4/5)" type="image/webp" srcset="{ss(h['slug'], h['ms'], '-m')}" sizes="100vw">
   <source type="image/webp" srcset="{ss(h['slug'], h['ds'])}" sizes="100vw">
   <img src="assets/img/hero/{h['slug']}-{mid[0]}.webp" alt="{h['alt']}" width="{mid[1][0]}" height="{mid[1][1]}" {'fetchpriority="high"' if first else 'loading="lazy" fetchpriority="low"'} decoding="async" draggable="false">
  </picture>
 </div>''')
        dots.append(f'<button type="button"{" class=\"on\"" if first else ""} aria-label="Foto {k + 1}: {h["title"]}" aria-pressed="{"true" if first else "false"}"></button>')
        if h.get('author'):
            credits.append(f'     <li>Abertura, {h["title"].lower()}: {h["author"]}, <a href="https://commons.wikimedia.org/wiki/File:{h["file"]}" target="_blank" rel="noopener">Wikimedia Commons</a>, <a href="{h["licurl"]}" target="_blank" rel="noopener">{h["lic"]}</a>, recortada e redimensionada.</li>')
    if not any(h.get('author') for h in meta):
        credits = ['     <li>Fotos da abertura: acervo da Guarita Imobiliária.</li>']
    h0 = meta[0]
    preload = (f'<link rel="preload" as="image" type="image/webp" href="assets/img/hero/{h0["slug"]}-1920.webp" imagesrcset="{ss(h0["slug"], h0["ds"])}" imagesizes="100vw" media="(min-aspect-ratio: 4/5)" fetchpriority="high">\n'
               f'<link rel="preload" as="image" type="image/webp" href="assets/img/hero/{h0["slug"]}-m-{h0["ms"][-1][0]}.webp" imagesrcset="{ss(h0["slug"], h0["ms"], "-m")}" imagesizes="100vw" media="(max-aspect-ratio: 4/5)" fetchpriority="high">')
    blocks = {
        'HERO-PRELOAD': preload,
        'HERO-SLIDES': '\n'.join(slides),
        'HERO-DOTS': f' <div class="dots" id="dots" role="group" aria-label="Paisagens de Balneário Camboriú">{"".join(dots)}</div>',
        'HERO-CREDITS': '\n'.join(credits),
    }
    for path in HTML:
        s = open(path, encoding='utf-8').read()
        for name, content in blocks.items():
            pat = re.compile(rf'[ \t]*<!--{name}(?::start)?-->(?:.*?<!--{name}:end-->)?', re.S)
            if pat.search(s):
                s = pat.sub(lambda _: f'<!--{name}:start-->\n{content}\n<!--{name}:end-->', s, count=1)
        open(path, 'w', encoding='utf-8').write(s)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
