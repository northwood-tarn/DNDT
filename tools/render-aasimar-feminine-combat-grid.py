#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "app/mini_preview/assets/pc_authored_library"
FIGURE = LIB / "aasimar_feminine_01/cutout/aasimar_feminine_01.png"
OUT = LIB / "aasimar_feminine_01/review/aasimar_feminine_01_combat_grid.png"

ORIGIN = (960, 120)
TILE = (128, 64)
GRID = (14, 10)


def project(x, y):
    return (ORIGIN[0] + (x - y) * TILE[0] / 2,
            ORIGIN[1] + (x + y) * TILE[1] / 2)


def main():
    canvas = Image.new("RGBA", (1920, 1080), "#111512")
    draw = ImageDraw.Draw(canvas)
    for x in range(GRID[0] + 1):
        draw.line((project(x, 0), project(x, GRID[1])), fill=(183, 205, 178, 112), width=2)
    for y in range(GRID[1] + 1):
        draw.line((project(0, y), project(GRID[0], y)), fill=(183, 205, 178, 112), width=2)

    anchor = project(7.5, 5.5)
    base_source = Image.open(ROOT / "app/mini_preview/assets/base_combinations/betrayers_coin.png").convert("RGBA")
    base = base_source.resize((115, round(base_source.height * 115 / base_source.width)), Image.Resampling.LANCZOS)
    scale = 115 / 192
    base_xy = (round(anchor[0] - 96 * scale), round(anchor[1] - 63.5 * scale))
    canvas.alpha_composite(base, base_xy)

    figure = Image.open(FIGURE).convert("RGBA")
    figure = figure.crop(figure.getchannel("A").getbbox())
    height = round(115 * 1.4)
    figure = figure.resize((round(figure.width * height / figure.height), height), Image.Resampling.LANCZOS)
    alpha = figure.getchannel("A")
    xs = [x for y in range(round(height * .88), height)
          for x in range(figure.width) if alpha.getpixel((x, y)) >= 160]
    feet_midpoint = round((min(xs) + max(xs)) / 2)
    contact_y = base_xy[1] + 34
    canvas.alpha_composite(figure, (round(anchor[0]) - feet_midpoint, contact_y - height))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUT)


if __name__ == "__main__":
    main()
