"""Draw Chill's app icons: the calm-water mark on the dark ground.

Run from anywhere:  python emergency/_tools/icons.py
Writes emergency/icons/{icon-192,icon-512,apple-touch-icon}.png.
Drawn at 4x and scaled down, so the edges are smooth.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "icons"
GROUND = (11, 13, 18, 255)
INK = (156, 195, 255, 255)


def draw(size, mark_scale):
    big = size * 4
    img = Image.new("RGBA", (big, big), GROUND)
    d = ImageDraw.Draw(img)
    cx = cy = big / 2
    r = big * 0.30 * mark_scale
    w = max(4, int(big * 0.055 * mark_scale))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=INK, width=w)
    # The wave: one gentle S across the middle, stamped as round dots so
    # the thick stroke has no seams and its ends come out rounded.
    half = r * 0.62
    steps = 600
    for i in range(steps + 1):
        t = i / steps
        x = cx - half + 2 * half * t
        y = cy + r * 0.10 - math.sin(t * 2 * math.pi) * r * 0.16
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=INK)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    draw(192, 1.0).save(OUT / "icon-192.png")
    draw(512, 0.86).save(OUT / "icon-512.png")  # room for Android's mask
    draw(180, 1.0).convert("RGB").save(OUT / "apple-touch-icon.png")
    print("wrote", ", ".join(p.name for p in sorted(OUT.glob("*.png"))))


if __name__ == "__main__":
    main()
