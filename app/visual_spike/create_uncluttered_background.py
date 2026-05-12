from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent
SRC = ROOT / "assets" / "dockside_stage.png"
OUT = ROOT / "assets" / "dockside_stage_uncluttered_v2.png"


def main():
    img = Image.open(SRC).convert("RGB")
    w, h = img.size
    arr = np.asarray(img).astype(np.float32)

    region = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(region)
    # Main playable floor and steps/soil area, avoiding the water and sky.
    draw.polygon(
        [(515, 360), (1035, 340), (1390, 520), (1385, 710), (1080, 865), (610, 805), (390, 610)],
        fill=255,
    )
    draw.polygon([(1080, 330), (1510, 345), (1505, 610), (1285, 575), (1120, 470)], fill=190)
    draw.polygon([(615, 425), (1115, 405), (1315, 548), (1180, 720), (700, 735), (430, 590)], fill=255)
    region_arr = np.asarray(region).astype(np.float32) / 255.0

    blur = np.asarray(img.filter(ImageFilter.GaussianBlur(18))).astype(np.float32)
    broad_blur = np.asarray(img.filter(ImageFilter.GaussianBlur(38))).astype(np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    mx = np.maximum.reduce([r, g, b])
    mn = np.minimum.reduce([r, g, b])
    sat = (mx - mn) / np.maximum(mx, 1)

    moss = ((g > r * 1.012) & (g > b * 0.88) & (sat > 0.045) & (lum > 22) & (lum < 155)).astype(
        np.float32
    )
    dark = ((lum < 66) & (lum > 10) & (sat < 0.5)).astype(np.float32)
    high_freq = np.mean(np.abs(arr - blur), axis=2)
    speckle = ((high_freq > 10) & (lum > 18) & (lum < 145)).astype(np.float32)
    patch = np.clip((moss * 0.78 + dark * 0.54 + speckle * 0.38) * region_arr, 0, 0.86)
    mask = Image.fromarray(np.uint8(patch * 255), "L").filter(ImageFilter.GaussianBlur(7))
    m = np.asarray(mask).astype(np.float32) / 255.0

    warm_floor = np.array([92, 78, 60], dtype=np.float32)
    local = blur * 0.52 + broad_blur * 0.22 + warm_floor * 0.26
    result = arr * (1 - m[:, :, None]) + local * m[:, :, None]

    green_pull = m * 0.38
    gray = (0.299 * result[:, :, 0] + 0.587 * result[:, :, 1] + 0.114 * result[:, :, 2])[:, :, None]
    result = result * (1 - green_pull[:, :, None]) + (
        gray * 0.68 + result * 0.32
    ) * green_pull[:, :, None]

    glaze = np.asarray(region.filter(ImageFilter.GaussianBlur(24))).astype(np.float32) / 255.0 * 0.095
    result = result * (1 - glaze[:, :, None]) + warm_floor * glaze[:, :, None]

    floor_smoothing = np.asarray(region.filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255.0 * 0.18
    result = result * (1 - floor_smoothing[:, :, None]) + (
        broad_blur * 0.62 + warm_floor * 0.38
    ) * floor_smoothing[:, :, None]

    Image.fromarray(np.uint8(np.clip(result, 0, 255))).save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
