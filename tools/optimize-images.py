"""One-off asset pipeline. Run manually; commit the contents of static/img/.

Reads the large originals in static/ (which are gitignored) and writes the small,
committed derivatives the site actually links to. Re-running is idempotent.

    python tools/optimize-images.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "static"
OUT = SRC / "img"

SCREENSHOTS = [
    "overview",
    "minotaur-battle",
    "bestiary-minotaur",
    "barracks",
    "build-menu",
    "select-army",
    "world-map",
    "army",
]

# Sources are 2940x1912 macOS Retina captures, i.e. a 1470px CSS-pixel window.
# 1470 is therefore the native logical resolution: shown at up to 1470 CSS px it is
# already 1:1, so only the full-bleed hero earns a 2x variant.
FULL_W = 1470
RETINA_W = 2940
THUMB_W = 735
RETINA = {"overview"}
OG_SIZE = (1200, 630)


def resized(im, width):
    if im.width == width:
        return im.copy()
    height = round(im.height * width / im.width)
    return im.resize((width, height), Image.LANCZOS)


def save_webp(im, name, quality):
    path = OUT / name
    im.save(path, "WEBP", quality=quality, method=6)
    return path


def cover_crop(im, size):
    target = size[0] / size[1]
    if im.width / im.height > target:
        w = round(im.height * target)
        box = ((im.width - w) // 2, 0, (im.width - w) // 2 + w, im.height)
    else:
        h = round(im.width / target)
        box = (0, (im.height - h) // 2, im.width, (im.height - h) // 2 + h)
    return im.crop(box).resize(size, Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    written = []

    for name in SCREENSHOTS:
        src = SRC / "screenshots" / f"{name}.png"
        if not src.exists():
            raise SystemExit(f"missing source: {src}")
        with Image.open(src) as im:
            im = im.convert("RGB")
            written.append(save_webp(resized(im, FULL_W), f"{name}.webp", 82))
            written.append(save_webp(resized(im, THUMB_W), f"{name}-thumb.webp", 80))
            if name in RETINA:
                written.append(save_webp(resized(im, RETINA_W), f"{name}@2x.webp", 78))
            if name == "overview":
                written.append(save_webp(cover_crop(im, OG_SIZE), "og-cover.webp", 85))
                # Some scrapers still refuse WebP for og:image.
                p = OUT / "og-cover.jpg"
                cover_crop(im, OG_SIZE).save(p, "JPEG", quality=86, optimize=True)
                written.append(p)

    # Castlefolk wordmark - transparent, so keep alpha.
    with Image.open(SRC / "logo.png") as im:
        im = im.convert("RGBA")
        written.append(save_webp(resized(im, 762), "wordmark.webp", 90))
        written.append(save_webp(resized(im, 1524), "wordmark@2x.webp", 88))

    # Peikko Labs studio mark - opaque square.
    with Image.open(SRC / "labs_logo.png") as im:
        written.append(save_webp(resized(im.convert("RGB"), 128), "peikko-labs.webp", 85))
        written.append(save_webp(resized(im.convert("RGB"), 256), "peikko-labs@2x.webp", 82))

    # Pixel-art app icon -> favicons. Nearest-neighbour to stay crisp.
    with Image.open(SRC / "app_icon.png") as im:
        im = im.convert("RGBA")
        for size, fname in ((32, "favicon-32.png"), (192, "favicon-192.png")):
            p = OUT / fname
            im.resize((size, size), Image.NEAREST).save(p, "PNG", optimize=True)
            written.append(p)
        p = OUT / "apple-touch-icon.png"
        # Apple does not composite alpha; flatten onto the ink background.
        icon = im.resize((180, 180), Image.NEAREST)
        bg = Image.new("RGBA", (180, 180), "#2b2118")
        Image.alpha_composite(bg, icon).convert("RGB").save(p, "PNG", optimize=True)
        written.append(p)

    # Cursor - browsers ignore cursors above ~32px.
    with Image.open(SRC / "mouse_pointer.png") as im:
        p = OUT / "cursor-32.png"
        im.convert("RGBA").resize((32, 32), Image.NEAREST).save(p, "PNG", optimize=True)
        written.append(p)

    total = sum(p.stat().st_size for p in written)
    for p in sorted(written):
        print(f"{p.stat().st_size:>9,}  {p.relative_to(ROOT).as_posix()}")
    print(f"\n{len(written)} files, {total / 1_048_576:.2f} MiB total")


if __name__ == "__main__":
    main()
