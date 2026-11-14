"""Reduz as fotos de public/img para no máximo 900px e JPEG qualidade 80.

Uso: python3 tools/otimizar_imagens.py
"""
from pathlib import Path

from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent / "public" / "img"
LIMITE = 900

for arq in sorted(RAIZ.rglob("*")):
    if arq.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        continue
    with Image.open(arq) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((LIMITE, LIMITE))
        destino = arq.with_suffix(".jpg")
        im.save(destino, "JPEG", quality=80, optimize=True, progressive=True)
    if destino != arq:
        arq.unlink()
    print(f"{destino.relative_to(RAIZ)}: {destino.stat().st_size // 1024} KB")
