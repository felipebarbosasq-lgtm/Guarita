#!/usr/bin/env python3
"""Gera dist/guarita-imobiliaria-site.zip com todo o projeto pronto para publicar.
Uso: python3 tools/make_zip.py"""
import os, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'guarita-imobiliaria-site.zip')
SKIP_DIRS = {'.git', 'node_modules', 'dist', '.netlify', 'screens', '__pycache__'}
SKIP_FILES = {'.env'}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
n = 0
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for f in sorted(files):
            if f in SKIP_FILES or f.endswith('.zip'):
                continue
            full = os.path.join(base, f)
            z.write(full, os.path.join('guarita-imobiliaria-site', os.path.relpath(full, ROOT)))
            n += 1
print(f'{OUT}: {n} arquivos, {os.path.getsize(OUT) / 1e6:.1f} MB')
