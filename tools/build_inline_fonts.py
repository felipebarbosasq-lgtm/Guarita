#!/usr/bin/env python3
"""Gera public/assets/css/fonts-inline.css (fontes em base64) a partir dos @font-face de site.css.
Usado só na visualização local (arquivo aberto direto do disco)."""
import base64, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
css = open(os.path.join(ROOT, 'public/assets/css/site.css'), encoding='utf-8').read()
out = ["/* Fontes embutidas, carregadas só quando o site é aberto direto do disco (file://),\n   onde os navegadores bloqueiam arquivos de fonte separados. Gerado por tools/build_inline_fonts.py. */"]
for face in re.findall(r"@font-face\{[^}]+\}", css):
    m = re.search(r"url\(\.\./fonts/([^)]+)\)", face)
    data = base64.b64encode(open(os.path.join(ROOT, 'public/assets/fonts', m.group(1)), 'rb').read()).decode()
    out.append(face.replace(m.group(0), f"url(data:font/woff2;base64,{data})"))
open(os.path.join(ROOT, 'public/assets/css/fonts-inline.css'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('fonts-inline.css gerado')
