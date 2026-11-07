#!/usr/bin/env python3
"""Gera dist/guarita-site-completo.html: o site em um único arquivo, com as imagens embutidas.
Uso: python3 tools/build_single.py   (a partir da raiz do projeto)"""
import base64, json, mimetypes, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
mimetypes.add_type('image/webp', '.webp')

def uri(path):
    data = open(os.path.join(ROOT, path), 'rb').read()
    return f"data:{mimetypes.guess_type(path)[0]};base64,{base64.b64encode(data).decode()}"

# preloads não fazem sentido com imagens embutidas
html = re.sub(r'<link rel="preload"[^>]*>\n?', '', html)
# srcset: mantém só a maior variante (evita embutir várias cópias)
def largest(m):
    cands = [c.strip().split() for c in m.group(2).split(',')]
    best = max(cands, key=lambda c: int(c[1][:-1]) if len(c) > 1 else 0)[0]
    return f'{m.group(1)}="{best}"'
html = re.sub(r'(srcset)="([^"]+)"', largest, html)
html = re.sub(r'\s(sizes|imagesizes)="[^"]*"', '', html)
# a fonte webp do logo duplica o PNG
html = re.sub(r'<source srcset="assets/img/site/logo.webp" type="image/webp">', '', html)
# atributos/URLs estáticos (og:image continua relativo)
html = html.replace('content="assets/img/site/og.jpg"', 'content="__OG__"')
html = re.sub(r'(?<=["(])assets/img/[\w/.-]+\.(?:webp|png|jpg)', lambda m: uri(m.group(0)), html)
html = html.replace('__OG__', 'assets/img/site/og.jpg')
# galeria (caminhos montados no JS)
gal = {}
gdir = 'assets/img/imovel/eleganza'
for f in sorted(os.listdir(os.path.join(ROOT, gdir))):
    if f.endswith('-1280.webp') or f.endswith('-t-200.webp'):
        gal[f'{gdir}/{f}'] = uri(f'{gdir}/{f}')
html = html.replace('<script>\n/* ===== CONFIGURAÇÃO', '<script>window.IMG=' + json.dumps(gal) + '</script>\n<script>\n/* ===== CONFIGURAÇÃO', 1)
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'guarita-site-completo.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, f'{os.path.getsize(out)/1e6:.1f} MB')
