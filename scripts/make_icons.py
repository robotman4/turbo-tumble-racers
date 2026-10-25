#!/usr/bin/env python3
"""Generate the PWA / home screen icons into public/icons, and (when the Capacitor projects exist)
the iOS and Android app icons and splash screens. Needs Pillow.
Turbo Tumble Racers: a blue kart with a panda driver flying off a striped ramp."""
from pathlib import Path
import math
import random
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
INK = (42, 31, 61)
S = 1024


def kart(d, cx, cy, k, tilt):
    lw = int(16 * k)

    def R(pts):
        c, s = math.cos(tilt), math.sin(tilt)
        return [(cx + (x * c - y * s) * k, cy + (x * s + y * c) * k) for x, y in pts]

    def circle(x, y, r, fill, w=lw):
        (px, py), = R([(x, y)])
        d.ellipse([px - r * k, py - r * k, px + r * k, py + r * k], fill=fill, outline=INK, width=w)

    # spoiler, body, nose
    d.polygon(R([(-250, -40), (-210, -120), (-160, -120), (-180, -40)]), fill=(255, 204, 26), outline=INK, width=lw)
    d.polygon(R([(-260, -40), (230, -40), (270, 40), (230, 90), (-250, 90)]), fill=(59, 143, 232), outline=INK, width=lw)
    d.polygon(R([(120, -40), (230, -40), (270, 40), (150, 40)]), fill=(255, 255, 255), outline=INK, width=lw)
    # panda driver
    circle(-40, -110, 95, (255, 255, 255))
    circle(-110, -190, 38, INK, 4)
    circle(30, -190, 38, INK, 4)
    circle(-75, -115, 26, INK, 4)
    circle(-5, -115, 26, INK, 4)
    circle(-70, -118, 10, (255, 255, 255), 2)
    circle(0, -118, 10, (255, 255, 255), 2)
    circle(-38, -75, 14, INK, 2)
    # wheels
    for x in (-170, 160):
        circle(x, 100, 70, INK)
        circle(x, 100, 30, (255, 204, 26), 6)


def make(maskable=False):
    big = S * 2
    img = Image.new("RGB", (big, big), (95, 191, 255))
    d = ImageDraw.Draw(img)
    for i in range(big):
        t = i / big
        d.line([(0, i), (big, i)], fill=(int(70 + 120 * t), int(170 + 70 * t), 255))
    rnd = random.Random(7)
    cols = [(232, 68, 58), (247, 212, 60), (92, 201, 90), (240, 111, 176), (155, 93, 229), (255, 255, 255)]
    for _ in range(70):
        x, y = rnd.randrange(big), rnd.randrange(big)
        w, h = rnd.randrange(14, 30), rnd.randrange(8, 16)
        d.rectangle([x, y, x + w, y + h], fill=rnd.choice(cols))
    # grass and a striped ramp
    d.rectangle([0, big * 0.8, big, big], fill=(108, 200, 74))
    d.line([(0, big * 0.8), (big, big * 0.8)], fill=INK, width=16)
    ramp = [(big * 0.05, big * 0.8), (big * 0.55, big * 0.8), (big * 0.55, big * 0.6)]
    d.polygon(ramp, fill=(255, 204, 26), outline=INK, width=16)
    for i in range(4):
        x0 = big * (0.18 + i * 0.09)
        y0 = big * 0.8 - (x0 - big * 0.05) / (big * 0.5) * big * 0.2
        d.polygon([(x0, big * 0.8 - 8), (x0 + 40, big * 0.8 - 8), (x0 + 40, y0 + 30), (x0, y0 + 46)], fill=(255, 122, 26))
    d.polygon(ramp, outline=INK, width=16)
    # speed lines
    for i in range(3):
        y = big * (0.36 + i * 0.07)
        d.line([(big * 0.08, y), (big * 0.3, y)], fill=(255, 255, 255), width=22)
    k = 2 * (0.78 if maskable else 1.0)
    kart(d, big * 0.6, big * 0.45, k, -0.35)
    return img.resize((S, S), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
base, mask = make(False), make(True)
base.resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")
base.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
base.resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")
mask.resize((512, 512), Image.LANCZOS).save(OUT / "icon-maskable-512.png")
print("icons written to", OUT)

# ---------- native apps (Capacitor) ----------
ROOT = Path(__file__).resolve().parent.parent
BLUE = (42, 127, 212)


def splash(size):
    """Brand blue with the icon in the middle (what shows while the app starts)."""
    img = Image.new("RGB", size, BLUE)
    k = int(min(size) * 0.32)
    icon = base.resize((k, k), Image.LANCZOS)
    m = Image.new("L", (k, k), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, k - 1, k - 1], radius=int(k * 0.22), fill=255)
    img.paste(icon, ((size[0] - k) // 2, (size[1] - k) // 2), m)
    return img


ios = ROOT / "ios/App/App/Assets.xcassets"
if ios.exists():
    base.convert("RGB").save(ios / "AppIcon.appiconset/AppIcon-512@2x.png")
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        splash((2732, 2732)).save(ios / "Splash.imageset" / name)
    print("iOS icon and splash written")

res = ROOT / "android/app/src/main/res"
if res.exists():
    for dpi, n in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
        d = res / f"mipmap-{dpi}"
        base.resize((n, n), Image.LANCZOS).save(d / "ic_launcher.png")
        rnd = Image.new("RGBA", (n, n), (0, 0, 0, 0))
        circle = Image.new("L", (n, n), 0)
        ImageDraw.Draw(circle).ellipse([0, 0, n - 1, n - 1], fill=255)
        rnd.paste(base.resize((n, n), Image.LANCZOS), (0, 0), circle)
        rnd.save(d / "ic_launcher_round.png")
        # Adaptive icon foreground: 108dp canvas, the launcher masks it to its own shape.
        f = n * 108 // 48
        mask.resize((f, f), Image.LANCZOS).save(d / "ic_launcher_foreground.png")
    (res / "values/ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2A7FD4</color>\n</resources>\n')
    for png in res.glob("drawable*/splash.png"):
        w, h = Image.open(png).size
        splash((w, h)).save(png)
    print("Android icons and splash written")

