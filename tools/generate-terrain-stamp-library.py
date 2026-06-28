#!/usr/bin/env python3
from __future__ import annotations

import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: generate-terrain-stamp-library.py <out-dir>", file=sys.stderr)
        return 1

    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)
    rng = random.Random(870143)

    floor = make_floor_stamp(rng)
    high = tint_stamp(make_floor_stamp(random.Random(870144)), (44, 34, 16), 0.28)
    slope = make_slope_stamp(random.Random(870145))
    cliff = make_cliff_stamp(random.Random(870146))
    rim = make_rim_debris_stamp(random.Random(870147))
    void = make_void_stamp(random.Random(870148))

    stamps = {
        "floor_negative_ink_v1.png": floor,
        "high_floor_negative_ink_v1.png": high,
        "slope_negative_ink_v1.png": slope,
        "cliff_face_negative_ink_v1.png": cliff,
        "rim_debris_negative_ink_v1.png": rim,
        "void_atmosphere_negative_ink_v1.png": void,
    }
    for name, image in stamps.items():
        image.save(out_dir / name)

    (out_dir / "MANIFEST.md").write_text(
        "\n".join(
            [
                "# Terrain Stamp Library v1",
                "",
                "Purpose-made reusable terrain stamps for DNDT combat-map composition.",
                "",
                "- `floor_negative_ink_v1.png`: generic walkable surface texture.",
                "- `high_floor_negative_ink_v1.png`: warmer elevated surface texture.",
                "- `slope_negative_ink_v1.png`: diagonal slope/ramp texture.",
                "- `cliff_face_negative_ink_v1.png`: vertical cliff-face strip.",
                "- `rim_debris_negative_ink_v1.png`: transparent edge debris/overhang dressing.",
                "- `void_atmosphere_negative_ink_v1.png`: background darkness/fog texture.",
                "",
                "These are test stamps generated procedurally. They validate the deterministic stamp-composition pipeline, not final art quality.",
            ]
        )
        + "\n"
    )
    print(out_dir)
    return 0


def make_floor_stamp(rng: random.Random) -> Image.Image:
    img = Image.new("RGBA", (640, 360), (32, 36, 32, 255))
    d = ImageDraw.Draw(img, "RGBA")
    add_washes(d, rng, img.size, [(58, 62, 51, 54), (8, 10, 10, 82), (94, 88, 64, 30)], 130)
    add_rock_grain(d, rng, img.size, 1250, alpha=(20, 95))
    add_surface_cracks(d, rng, img.size, 115, alpha=(40, 120))
    return img.filter(ImageFilter.GaussianBlur(0.25))


def make_slope_stamp(rng: random.Random) -> Image.Image:
    img = Image.new("RGBA", (640, 360), (34, 42, 32, 255))
    d = ImageDraw.Draw(img, "RGBA")
    add_washes(d, rng, img.size, [(67, 80, 48, 62), (11, 15, 13, 90), (112, 107, 62, 26)], 150)
    for _ in range(180):
        x = rng.randrange(-80, 640)
        y = rng.randrange(0, 360)
        length = rng.randrange(40, 190)
        d.line((x, y, x + length, y + length * 0.22), fill=(99, 114, 67, rng.randrange(38, 118)), width=1)
    add_rock_grain(d, rng, img.size, 900, alpha=(20, 80))
    return img.filter(ImageFilter.GaussianBlur(0.18))


def make_cliff_stamp(rng: random.Random) -> Image.Image:
    img = Image.new("RGBA", (384, 560), (16, 18, 17, 255))
    d = ImageDraw.Draw(img, "RGBA")
    add_washes(d, rng, img.size, [(42, 42, 36, 70), (4, 5, 5, 120), (92, 82, 56, 26)], 100)
    for _ in range(620):
        x = rng.randrange(0, 384)
        y = rng.randrange(-20, 560)
        length = rng.randrange(18, 160)
        sway = rng.uniform(-18, 18)
        color = (4, 5, 5, rng.randrange(60, 180)) if rng.random() < 0.7 else (92, 79, 55, rng.randrange(22, 88))
        d.line((x, y, x + sway, y + length), fill=color, width=1 if rng.random() < 0.82 else 2)
    for _ in range(75):
        x = rng.randrange(0, 384)
        y = rng.randrange(0, 560)
        d.rectangle((x, y, x + rng.randrange(8, 52), y + rng.randrange(3, 14)), fill=(0, 0, 0, rng.randrange(22, 80)))
    return img.filter(ImageFilter.GaussianBlur(0.15))


def make_rim_debris_stamp(rng: random.Random) -> Image.Image:
    img = Image.new("RGBA", (512, 180), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(520):
        x = rng.randrange(0, 512)
        y = int(rng.triangular(20, 160, 70))
        length = rng.randrange(4, 46)
        angle = rng.uniform(-0.65, 0.65)
        color = (5, 6, 6, rng.randrange(60, 180)) if rng.random() < 0.65 else (116, 101, 69, rng.randrange(30, 105))
        d.line((x, y, x + math.cos(angle) * length, y + math.sin(angle) * length * 0.5), fill=color, width=1)
    return img.filter(ImageFilter.GaussianBlur(0.3))


def make_void_stamp(rng: random.Random) -> Image.Image:
    img = Image.new("RGBA", (960, 540), (2, 4, 5, 255))
    d = ImageDraw.Draw(img, "RGBA")
    add_washes(d, rng, img.size, [(11, 14, 14, 70), (0, 0, 0, 120), (30, 31, 28, 24)], 260)
    return img.filter(ImageFilter.GaussianBlur(1.8))


def add_washes(
    draw: ImageDraw.ImageDraw,
    rng: random.Random,
    size: tuple[int, int],
    palette: list[tuple[int, int, int, int]],
    count: int,
) -> None:
    width, height = size
    for _ in range(count):
        color = rng.choice(palette)
        x = rng.randrange(-width // 8, width + width // 8)
        y = rng.randrange(-height // 8, height + height // 8)
        rx = rng.randrange(max(16, width // 18), max(24, width // 3))
        ry = rng.randrange(max(8, height // 22), max(16, height // 4))
        draw.ellipse((x - rx, y - ry, x + rx, y + ry), fill=color)


def add_rock_grain(
    draw: ImageDraw.ImageDraw,
    rng: random.Random,
    size: tuple[int, int],
    count: int,
    alpha: tuple[int, int],
) -> None:
    width, height = size
    for _ in range(count):
        x = rng.randrange(0, width)
        y = rng.randrange(0, height)
        rx = rng.uniform(0.5, 4.0)
        ry = rng.uniform(0.3, 1.8)
        shade = rng.randrange(16, 120)
        draw.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(shade, shade, shade - min(10, shade), rng.randrange(*alpha)))


def add_surface_cracks(
    draw: ImageDraw.ImageDraw,
    rng: random.Random,
    size: tuple[int, int],
    count: int,
    alpha: tuple[int, int],
) -> None:
    width, height = size
    for _ in range(count):
        x = rng.randrange(0, width)
        y = rng.randrange(0, height)
        points = [(x, y)]
        angle = rng.uniform(-0.55, 0.35)
        for _step in range(rng.randrange(2, 7)):
            px, py = points[-1]
            length = rng.randrange(10, 55)
            angle += rng.uniform(-0.22, 0.22)
            points.append((px + math.cos(angle) * length, py + math.sin(angle) * length * 0.45))
        draw.line(points, fill=(2, 4, 4, rng.randrange(*alpha)), width=1)


def tint_stamp(img: Image.Image, color: tuple[int, int, int], strength: float) -> Image.Image:
    out = img.copy()
    out.alpha_composite(Image.new("RGBA", out.size, (*color, int(255 * strength))))
    return out


if __name__ == "__main__":
    raise SystemExit(main())
