#!/usr/bin/env python3
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "app/mini_preview/assets/pc_authored_library"
OUT = LIB / "tieflings/review/tieflings_stance_1_coin_check_100pct.png"

FIGURES = (
    LIB / "tiefling_feminine_01/cutout/tiefling_feminine_01.png",
    LIB / "tiefling_masculine_01/cutout/tiefling_masculine_01.png",
)


def fitted_figure(path):
    source = Image.open(path).convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    figure = source.crop(bounds)
    height = 700
    width = round(figure.width * height / figure.height)
    return figure.resize((width, height), Image.Resampling.LANCZOS)


def foot_midpoint(figure):
    alpha = figure.getchannel("A")
    # Stance is anchored from the opaque boot pixels in the bottom 12% only;
    # tail pixels and upper-body silhouette cannot affect horizontal placement.
    y0 = round(figure.height * 0.88)
    points = []
    for y in range(y0, figure.height):
        for x in range(figure.width):
            if alpha.getpixel((x, y)) >= 160:
                points.append(x)
    return round((min(points) + max(points)) / 2)


def main():
    canvas = Image.new("RGBA", (1800, 1050), (236, 232, 222, 255))
    base = Image.open(ROOT / "app/mini_preview/assets/base_combinations/betrayers_coin.png").convert("RGBA")
    base = base.resize((500, round(base.height * 500 / base.width)), Image.Resampling.LANCZOS)
    for index, path in enumerate(FIGURES):
        panel_x = index * 900
        canvas.alpha_composite(base, (panel_x + 200, 770))
        figure = fitted_figure(path)
        x = panel_x + 450 - foot_midpoint(figure)
        canvas.alpha_composite(figure, (x, 239))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUT, format="PNG")


if __name__ == "__main__":
    main()
