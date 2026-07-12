#!/usr/bin/env python3
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "app/mini_preview/assets/pc_authored_library"
SOURCE = LIB / "cloaked_protagonist_01/cutout/cloaked_protagonist_01.png"
OUT = LIB / "cloaked_protagonist_01/review/cloaked_protagonist_01_posture_2_coin_check_left_23px.png"


def main():
    canvas = Image.new("RGBA", (900, 1050), (236, 232, 222, 255))
    base = Image.open(ROOT / "app/mini_preview/assets/base_combinations/betrayers_coin.png").convert("RGBA")
    base = base.resize((500, round(base.height * 500 / base.width)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(base, (200, 770))

    figure = Image.open(SOURCE).convert("RGBA")
    figure = figure.crop(figure.getchannel("A").getbbox())
    height = 700
    figure = figure.resize((round(figure.width * height / figure.height), height), Image.Resampling.LANCZOS)
    alpha = figure.getchannel("A")
    xs = [x for y in range(round(height * .88), height)
          for x in range(figure.width) if alpha.getpixel((x, y)) >= 160]
    feet_midpoint = round((min(xs) + max(xs)) / 2)
    canvas.alpha_composite(figure, (450 - feet_midpoint - 23, 239))
    canvas.convert("RGB").save(OUT)


if __name__ == "__main__":
    main()
