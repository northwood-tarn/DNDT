#!/usr/bin/env python3
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "app/mini_preview/assets/pc_authored_library"
FIGURE = LIB / "aasimar_feminine_01/cutout/aasimar_feminine_01.png"
OUT = LIB / "aasimar_feminine_01/runtime/aasimar_feminine_01_betrayers_coin_192x320.png"


def main():
    canvas = Image.new("RGBA", (192, 320))
    base_source = Image.open(ROOT / "app/mini_preview/assets/base_combinations/betrayers_coin.png").convert("RGBA")
    base = base_source.resize((115, round(base_source.height * 115 / base_source.width)), Image.Resampling.LANCZOS)
    base_xy = ((192 - base.width) // 2, 242)
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
    canvas.alpha_composite(figure, (96 - feet_midpoint, contact_y - height))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT)


if __name__ == "__main__":
    main()
