#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


WIDTH = 1920
HEIGHT = 1080


def main() -> int:
    if len(sys.argv) != 4:
        print("Usage: render-grid-terrain-from-stamps.py <grid.json> <stamp-dir> <out.png>", file=sys.stderr)
        return 1

    grid_path = Path(sys.argv[1])
    stamp_dir = Path(sys.argv[2])
    out_path = Path(sys.argv[3])
    data = json.loads(grid_path.read_text())
    stamps = load_stamps(stamp_dir)
    render(data, stamps).save(out_path)
    print(out_path)
    return 0


def load_stamps(stamp_dir: Path) -> dict[str, Image.Image]:
    files = {
        "floor": "floor_negative_ink_v1.png",
        "high": "high_floor_negative_ink_v1.png",
        "slope": "slope_negative_ink_v1.png",
        "cliff": "cliff_face_negative_ink_v1.png",
        "rim": "rim_debris_negative_ink_v1.png",
        "void": "void_atmosphere_negative_ink_v1.png",
    }
    return {key: Image.open(stamp_dir / name).convert("RGBA") for key, name in files.items()}


def render(data: dict, stamps: dict[str, Image.Image]) -> Image.Image:
    rng = random.Random(stable_seed(data.get("stageId", "stage") + ":stamp-composed"))
    grid = data["grid"]
    cells = build_cell_index(data)
    masks = build_masks(cells, grid)

    img = tile_stamp(stamps["void"], (WIDTH, HEIGHT), rng, scale=(0.85, 1.35))
    img = ImageEnhance.Brightness(img).enhance(0.62)
    add_void_depth(img, masks["terrain"], rng)

    cliff_mask = build_cliff_mask(cells, grid)
    img.alpha_composite(masked(tile_stamp(stamps["cliff"], (WIDTH, HEIGHT), rng, scale=(0.7, 1.25)), cliff_mask))
    add_cliff_lines(img, cliff_mask, rng)

    floor_layer = tile_stamp(stamps["floor"], (WIDTH, HEIGHT), rng, scale=(0.65, 1.18))
    high_layer = tile_stamp(stamps["high"], (WIDTH, HEIGHT), rng, scale=(0.72, 1.24))
    slope_layer = tile_stamp(stamps["slope"], (WIDTH, HEIGHT), rng, scale=(0.72, 1.20))

    img.alpha_composite(masked(floor_layer, masks["low"]))
    img.alpha_composite(masked(tint(floor_layer, (24, 22, 12), 0.16), masks["mid"]))
    img.alpha_composite(masked(high_layer, masks["high"]))
    img.alpha_composite(masked(slope_layer, masks["slope"]))

    add_visual_overhangs(img, stamps, masks["terrain"], rng)
    add_mask_boundary_breakup(img, stamps["rim"], masks["terrain"], rng)
    add_height_edge_readability(img, cells, grid, rng)
    add_surface_unifiers(img, masks["terrain"], rng)
    add_vignette(img)
    return img


def build_cell_index(data: dict) -> dict[tuple[int, int], dict]:
    grid = data["grid"]
    cells = {
        (x, y): {"x": x, "y": y, "altitude": 0, "walkable": False, "blocked": True}
        for y in range(grid["height"])
        for x in range(grid["width"])
    }
    for cell in data.get("altitude", {}).get("cells", []):
        cells[(cell["x"], cell["y"])]["altitude"] = cell.get("height", 0)
    for cell in data.get("walkable", {}).get("cells", []):
        cells[(cell["x"], cell["y"])].update(walkable=True, blocked=False)
    for cell in data.get("blocked", []):
        cells[(cell["x"], cell["y"])].update(blocked=True, walkable=False, blockedKind=cell.get("kind"))
    for cell in data.get("slopes", []):
        cells[(cell["x"], cell["y"])].update(slope=True, walkable=True, blocked=False)
    for cover in data.get("cover", []):
        cells[(cover["x"], cover["y"])].update(cover=cover, walkable=True, blocked=False, reserved=True)
    for feature in data.get("features", []):
        cells[(feature["x"], feature["y"])].update(feature=feature, walkable=True, blocked=False, reserved=True)
    return cells


def build_masks(cells: dict[tuple[int, int], dict], grid: dict) -> dict[str, Image.Image]:
    masks = {key: Image.new("L", (WIDTH, HEIGHT), 0) for key in ("terrain", "low", "mid", "high", "slope")}
    draws = {key: ImageDraw.Draw(mask) for key, mask in masks.items()}
    for cell in cells.values():
        if not is_drawable(cell):
            continue
        poly = diamond(cell["x"], cell["y"], grid)
        draws["terrain"].polygon(poly, fill=255)
        if cell.get("slope"):
            key = "slope"
        elif cell["altitude"] >= 4:
            key = "high"
        elif cell["altitude"] > 0:
            key = "mid"
        else:
            key = "low"
        draws[key].polygon(poly, fill=255)
    return masks


def build_cliff_mask(cells: dict[tuple[int, int], dict], grid: dict) -> Image.Image:
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    d = ImageDraw.Draw(mask)
    for cell in cells.values():
        if not is_drawable(cell):
            continue
        x = cell["x"]
        y = cell["y"]
        h = cell["altitude"]
        for nx, ny, side in ((x + 1, y, "right"), (x, y + 1, "left")):
            neighbor = cells.get((nx, ny))
            if neighbor and is_drawable(neighbor):
                drop = h - neighbor["altitude"]
            else:
                drop = max(1, h + 1)
            if drop <= 0:
                continue
            edge = cell_edge(x, y, grid, side)
            depth = min(190, 46 + drop * 34)
            lean = 8 if side == "right" else -8
            d.polygon(
                [
                    edge[0],
                    edge[1],
                    (edge[1][0] + lean, edge[1][1] + depth),
                    (edge[0][0] + lean, edge[0][1] + depth),
                ],
                fill=235,
            )
    return mask.filter(ImageFilter.GaussianBlur(0.35))


def tile_stamp(stamp: Image.Image, size: tuple[int, int], rng: random.Random, scale: tuple[float, float]) -> Image.Image:
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    base_w = max(1, int(stamp.width * rng.uniform(*scale)))
    base_h = max(1, int(stamp.height * rng.uniform(*scale)))
    tile = stamp.resize((base_w, base_h), Image.Resampling.LANCZOS)
    x_offset = -rng.randrange(0, base_w)
    y_offset = -rng.randrange(0, base_h)
    for y in range(y_offset, size[1], base_h):
        for x in range(x_offset, size[0], base_w):
            variant = tile
            if rng.random() < 0.5:
                variant = ImageOps.mirror(variant)
            if rng.random() < 0.35:
                variant = ImageOps.flip(variant)
            out.alpha_composite(variant, (x, y))
    return out


def add_void_depth(img: Image.Image, terrain_mask: Image.Image, rng: random.Random) -> None:
    void = ImageChops.invert(terrain_mask)
    near = ImageChops.multiply(void, terrain_mask.filter(ImageFilter.GaussianBlur(26)))
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    for _ in range(90):
        x = rng.randrange(0, WIDTH)
        y = rng.randrange(40, HEIGHT)
        rx = rng.randrange(70, 250)
        ry = rng.randrange(18, 70)
        d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(20, 23, 21, rng.randrange(12, 48)))
    layer = layer.filter(ImageFilter.GaussianBlur(9))
    img.alpha_composite(masked(layer, near))


def add_mask_boundary_breakup(img: Image.Image, rim_stamp: Image.Image, terrain_mask: Image.Image, rng: random.Random) -> None:
    outer = terrain_mask.filter(ImageFilter.MaxFilter(45))
    inner = terrain_mask.filter(ImageFilter.MinFilter(21))
    band = ImageChops.subtract(outer, inner).filter(ImageFilter.GaussianBlur(1.0))
    stamp_layer = tile_stamp(rim_stamp, (WIDTH, HEIGHT), rng, scale=(0.85, 1.45))
    img.alpha_composite(masked(stamp_layer, band))


def add_visual_overhangs(img: Image.Image, stamps: dict[str, Image.Image], terrain_mask: Image.Image, rng: random.Random) -> None:
    outer = terrain_mask.filter(ImageFilter.MaxFilter(95))
    inner = terrain_mask.filter(ImageFilter.MinFilter(13))
    band = ImageChops.subtract(outer, inner).filter(ImageFilter.GaussianBlur(2.2))
    noise = make_noise_mask((WIDTH, HEIGHT), rng, blur=9)
    broken_band = ImageChops.multiply(band, noise.point(lambda v: 255 if v > 90 else max(0, v - 20)))

    shadow = tile_stamp(stamps["cliff"], (WIDTH, HEIGHT), rng, scale=(0.9, 1.8))
    shadow = ImageEnhance.Brightness(shadow).enhance(0.35)
    shadow = ImageEnhance.Contrast(shadow).enhance(1.35)
    img.alpha_composite(masked(shadow, broken_band.point(lambda v: int(v * 0.62))))

    dark = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 130))
    img.alpha_composite(masked(dark, broken_band.point(lambda v: int(v * 0.44))))

    ink = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    d = ImageDraw.Draw(ink, "RGBA")
    bbox = outer.getbbox() or (0, 0, WIDTH, HEIGHT)
    x0, y0, x1, y1 = bbox
    for _ in range(1400):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        if broken_band.getpixel((x, y)) < 24:
            continue
        length = rng.randrange(8, 70)
        angle = rng.choice((-0.35, 0.35, 2.75, -2.75, 1.55))
        d.line((x, y, x + math.cos(angle) * length, y + math.sin(angle) * length * 0.5), fill=(0, 0, 0, rng.randrange(54, 160)), width=1)
    img.alpha_composite(masked(ink, broken_band))


def make_noise_mask(size: tuple[int, int], rng: random.Random, blur: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    for _ in range(900):
        x = rng.randrange(0, size[0])
        y = rng.randrange(0, size[1])
        rx = rng.randrange(8, 80)
        ry = rng.randrange(4, 34)
        d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=rng.randrange(55, 255))
    return mask.filter(ImageFilter.GaussianBlur(blur))


def add_cliff_lines(img: Image.Image, cliff_mask: Image.Image, rng: random.Random) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    bbox = cliff_mask.getbbox() or (0, 0, WIDTH, HEIGHT)
    x0, y0, x1, y1 = bbox
    for _ in range(900):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        if cliff_mask.getpixel((x, y)) < 8:
            continue
        length = rng.randrange(20, 135)
        sway = rng.uniform(-14, 14)
        color = (3, 4, 4, rng.randrange(55, 170)) if rng.random() < 0.74 else (100, 84, 56, rng.randrange(22, 78))
        d.line((x, y, x + sway, y + length), fill=color, width=1)
    img.alpha_composite(masked(layer, cliff_mask))


def add_height_edge_readability(img: Image.Image, cells: dict[tuple[int, int], dict], grid: dict, rng: random.Random) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    for cell in cells.values():
        if not is_drawable(cell):
            continue
        x = cell["x"]
        y = cell["y"]
        for nx, ny, side in ((x + 1, y, "right"), (x, y + 1, "left")):
            neighbor = cells.get((nx, ny))
            if neighbor and is_drawable(neighbor) and neighbor["altitude"] == cell["altitude"] and not cell.get("slope"):
                continue
            edge = cell_edge(x, y, grid, side)
            d.line(edge, fill=(122, 111, 79, 38), width=1)
            for _ in range(3):
                t = rng.random()
                px = edge[0][0] + (edge[1][0] - edge[0][0]) * t
                py = edge[0][1] + (edge[1][1] - edge[0][1]) * t
                d.line((px, py, px + rng.uniform(-16, 16), py + rng.uniform(-4, 8)), fill=(3, 4, 4, 96), width=1)
    img.alpha_composite(layer)


def add_surface_unifiers(img: Image.Image, terrain_mask: Image.Image, rng: random.Random) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    bbox = terrain_mask.getbbox() or (0, 0, WIDTH, HEIGHT)
    x0, y0, x1, y1 = bbox
    for _ in range(55):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        rx = rng.randrange(42, 190)
        ry = rng.randrange(10, 42)
        color = (126, 116, 82, rng.randrange(10, 38)) if rng.random() < 0.55 else (0, 0, 0, rng.randrange(16, 54))
        d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(7))
    img.alpha_composite(masked(layer, terrain_mask))


def add_vignette(img: Image.Image) -> None:
    alpha = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(alpha)
    d.rectangle((0, 0, WIDTH, HEIGHT), fill=220)
    for inset, value in ((74, 158), (190, 92), (350, 40)):
        d.rounded_rectangle((inset, inset // 2, WIDTH - inset, HEIGHT - inset // 2), radius=90, fill=value)
    img.alpha_composite(masked(Image.new("RGBA", img.size, (0, 0, 0, 172)), alpha))


def tint(img: Image.Image, color: tuple[int, int, int], strength: float) -> Image.Image:
    out = img.copy()
    out.alpha_composite(Image.new("RGBA", out.size, (*color, int(255 * strength))))
    return out


def masked(texture: Image.Image, mask: Image.Image) -> Image.Image:
    return Image.composite(texture, Image.new("RGBA", texture.size, (0, 0, 0, 0)), mask)


def is_drawable(cell: dict) -> bool:
    return not cell["blocked"] or cell.get("reserved")


def center(x: int, y: int, grid: dict) -> tuple[float, float]:
    return (
        grid["origin"]["x"] + ((x - y) * grid["tileWidth"]) / 2,
        grid["origin"]["y"] + ((x + y) * grid["tileHeight"]) / 2,
    )


def diamond(x: int, y: int, grid: dict) -> list[tuple[float, float]]:
    cx, cy = center(x, y, grid)
    hw = grid["tileWidth"] / 2
    hh = grid["tileHeight"] / 2
    return [(cx, cy - hh), (cx + hw, cy), (cx, cy + hh), (cx - hw, cy)]


def cell_edge(x: int, y: int, grid: dict, side: str) -> tuple[tuple[float, float], tuple[float, float]]:
    points = diamond(x, y, grid)
    if side == "right":
        return points[1], points[2]
    if side == "left":
        return points[2], points[3]
    raise ValueError(side)


def stable_seed(value: str) -> int:
    seed = 0
    for char in value:
        seed = ((seed * 131) + ord(char)) & 0xFFFFFFFF
    return seed


if __name__ == "__main__":
    raise SystemExit(main())
