#!/usr/bin/env python3
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "app/mini_preview/assets/pc_authored_library"
FIGURES = (
    LIB / "dragonborn_masculine_01/cutout/dragonborn_masculine_01.png",
    LIB / "dragonborn_feminine_01/cutout/dragonborn_feminine_01.png",
)
OUT = LIB / "dragonborn/review/dragonborn_posture_2_coin_check_105pct.png"


def fitted(path):
    image = Image.open(path).convert("RGBA")
    image = image.crop(image.getchannel("A").getbbox())
    height = 735  # 105% of the 700 px human reference height
    return image.resize((round(image.width * height / image.height), height), Image.Resampling.LANCZOS)


def feet_midpoint(image):
    alpha = image.getchannel("A")
    xs = [x for y in range(round(image.height * .88), image.height)
          for x in range(image.width) if alpha.getpixel((x, y)) >= 160]
    return round((min(xs) + max(xs)) / 2)


def main():
    canvas = Image.new("RGBA", (1800, 1100), (236, 232, 222, 255))
    base = Image.open(ROOT / "app/mini_preview/assets/base_combinations/betrayers_coin.png").convert("RGBA")
    base = base.resize((500, round(base.height * 500 / base.width)), Image.Resampling.LANCZOS)
    contact_y = 989
    for i, path in enumerate(FIGURES):
        panel = i * 900
        canvas.alpha_composite(base, (panel + 200, 820))
        figure = fitted(path)
        canvas.alpha_composite(figure, (panel + 450 - feet_midpoint(figure), contact_y - figure.height))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUT)


if __name__ == "__main__":
    main()
