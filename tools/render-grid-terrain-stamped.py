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
        print("Usage: render-grid-terrain-stamped.py <grid.json> <style-source.png> <out.png>", file=sys.stderr)
        return 1

    grid_path = Path(sys.argv[1])
    style_path = Path(sys.argv[2])
    out_path = Path(sys.argv[3])
    data = json.loads(grid_path.read_text())
    style = Image.open(style_path).convert("RGBA")
    render(data, style).save(out_path)
    print(out_path)
    return 0


def render(data: dict, style: Image.Image) -> Image.Image:
    rng = random.Random(stable_seed(data.get("stageId", "stage") + ":stamped"))
    grid = data["grid"]
    cells = build_cell_index(data)
    masks = build_masks(cells, grid)

    texture = prepare_style_texture(style, rng)
    void_texture = darken(texture, 0.16, 0.62)
    floor_texture = darken(texture, 0.58, 0.92)
    high_texture = tint(darken(texture, 0.72, 0.98), (34, 22, 7), 0.18)
    slope_texture = tint(darken(texture, 0.62, 0.92), (12, 35, 12), 0.14)
    cliff_texture = darken(texture, 0.28, 0.75)

    img = Image.new("RGBA", (WIDTH, HEIGHT), (3, 5, 6, 255))
    img.alpha_composite(void_texture)
    add_void_atmosphere(img, masks["terrain"], rng)

    # Soft non-affordance overpaint hides the tactical construction around edges.
    visual_mass = masks["terrain"].filter(ImageFilter.MaxFilter(35)).filter(ImageFilter.GaussianBlur(5))
    near_mass = ImageChops.subtract(visual_mass, masks["terrain"].filter(ImageFilter.MinFilter(5)))
    img.alpha_composite(masked(darken(texture, 0.32, 0.74), near_mass.point(lambda v: int(v * 0.72))))

    cliff_mask = build_cliff_mask(cells, grid).filter(ImageFilter.GaussianBlur(0.6))
    img.alpha_composite(masked(cliff_texture, cliff_mask))
    draw_cliff_ink(img, cliff_mask, rng)

    img.alpha_composite(masked(floor_texture, masks["low"]))
    img.alpha_composite(masked(tint(floor_texture, (28, 25, 9), 0.16), masks["mid"]))
    img.alpha_composite(masked(high_texture, masks["high"]))
    img.alpha_composite(masked(slope_texture, masks["slope"]))

    add_surface_focus(img, masks, rng)
    add_tactical_edge_hints(img, cells, grid, rng)
    add_ragged_non_affordance_edges(img, masks["terrain"], rng)
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
        h = cell["altitude"]
        x = cell["x"]
        y = cell["y"]
        for nx, ny, side in ((x + 1, y, "right"), (x, y + 1, "left")):
            neighbor = cells.get((nx, ny))
            if neighbor and is_drawable(neighbor):
                drop = h - neighbor["altitude"]
            else:
                drop = max(1, h + 1)
            if drop <= 0:
                continue
            edge = cell_edge(x, y, grid, side)
            depth = min(180, 42 + drop * 30)
            jitter = 10 if side == "right" else -10
            face = [
                edge[0],
                edge[1],
                (edge[1][0] + jitter, edge[1][1] + depth),
                (edge[0][0] + jitter, edge[0][1] + depth),
            ]
            d.polygon(face, fill=230)
    return mask


def prepare_style_texture(style: Image.Image, rng: random.Random) -> Image.Image:
    source = style.convert("RGBA")
    source = ImageEnhance.Color(source).enhance(0.18)
    source = ImageEnhance.Contrast(source).enhance(1.35)
    source = ImageEnhance.Sharpness(source).enhance(0.9)

    base = Image.new("RGBA", (WIDTH, HEIGHT), (20, 22, 20, 255))
    base.alpha_composite(ImageOps.fit(source, (WIDTH, HEIGHT), method=Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(22)))
    sw, sh = source.size

    for _ in range(190):
        crop_w = rng.randrange(max(80, sw // 18), max(120, sw // 5))
        crop_h = rng.randrange(max(60, sh // 18), max(100, sh // 5))
        sx = rng.randrange(0, max(1, sw - crop_w))
        sy = rng.randrange(0, max(1, sh - crop_h))
        patch = source.crop((sx, sy, sx + crop_w, sy + crop_h))
        patch = ImageEnhance.Brightness(patch).enhance(rng.uniform(0.52, 1.18))
        patch = ImageEnhance.Contrast(patch).enhance(rng.uniform(0.82, 1.45))
        target_w = rng.randrange(140, 420)
        target_h = rng.randrange(52, 190)
        patch = patch.resize((target_w, target_h), Image.Resampling.LANCZOS)
        patch = patch.rotate(rng.uniform(-14, 14), resample=Image.Resampling.BICUBIC, expand=True)
        patch_alpha = Image.new("L", patch.size, rng.randrange(24, 92))
        patch_alpha = patch_alpha.filter(ImageFilter.GaussianBlur(rng.uniform(1.5, 8.0)))
        x = rng.randrange(-patch.width // 2, WIDTH)
        y = rng.randrange(-patch.height // 2, HEIGHT)
        base.paste(patch, (x, y), patch_alpha)

    base = ImageEnhance.Contrast(base).enhance(1.08)
    return base.convert("RGBA")


def darken(img: Image.Image, brightness: float, contrast: float) -> Image.Image:
    out = ImageEnhance.Brightness(img).enhance(brightness)
    out = ImageEnhance.Contrast(out).enhance(contrast)
    return out.convert("RGBA")


def tint(img: Image.Image, color: tuple[int, int, int], strength: float) -> Image.Image:
    overlay = Image.new("RGBA", img.size, (*color, int(255 * strength)))
    out = img.copy()
    out.alpha_composite(overlay)
    return out


def masked(texture: Image.Image, mask: Image.Image) -> Image.Image:
    return Image.composite(texture, Image.new("RGBA", texture.size, (0, 0, 0, 0)), mask)


def add_void_atmosphere(img: Image.Image, terrain_mask: Image.Image, rng: random.Random) -> None:
    void_mask = ImageChops.invert(terrain_mask)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    for _ in range(120):
        x = rng.randrange(0, WIDTH)
        y = rng.randrange(0, HEIGHT)
        rx = rng.randrange(60, 280)
        ry = rng.randrange(18, 86)
        d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(15, 18, 17, rng.randrange(10, 42)))
    layer = layer.filter(ImageFilter.GaussianBlur(9))
    img.alpha_composite(masked(layer, void_mask))


def add_surface_focus(img: Image.Image, masks: dict[str, Image.Image], rng: random.Random) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    terrain_bbox = masks["terrain"].getbbox() or (0, 0, WIDTH, HEIGHT)
    x0, y0, x1, y1 = terrain_bbox
    for _ in range(42):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        rx = rng.randrange(28, 150)
        ry = rng.randrange(8, 36)
        d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(138, 126, 86, rng.randrange(12, 42)))
    layer = layer.filter(ImageFilter.GaussianBlur(6))
    img.alpha_composite(masked(layer, masks["terrain"]))


def add_tactical_edge_hints(img: Image.Image, cells: dict[tuple[int, int], dict], grid: dict, rng: random.Random) -> None:
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
            if rng.random() < 0.75:
                d.line(edge, fill=(138, 125, 83, 44), width=1)
            for _ in range(3):
                t = rng.random()
                px = edge[0][0] + (edge[1][0] - edge[0][0]) * t
                py = edge[0][1] + (edge[1][1] - edge[0][1]) * t
                d.line((px, py, px + rng.uniform(-14, 14), py + rng.uniform(-4, 9)), fill=(22, 25, 22, 90), width=1)
    img.alpha_composite(layer)


def add_ragged_non_affordance_edges(img: Image.Image, terrain_mask: Image.Image, rng: random.Random) -> None:
    inner = terrain_mask.filter(ImageFilter.MinFilter(25))
    rim = ImageChops.subtract(terrain_mask, inner)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    bbox = terrain_mask.getbbox() or (0, 0, WIDTH, HEIGHT)
    x0, y0, x1, y1 = bbox
    for _ in range(1600):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        if rim.getpixel((x, y)) == 0:
            continue
        length = rng.randrange(3, 26)
        angle = rng.uniform(-math.pi, math.pi)
        color = (4, 6, 6, rng.randrange(70, 180)) if rng.random() < 0.75 else (112, 102, 70, rng.randrange(26, 82))
        d.line((x, y, x + math.cos(angle) * length, y + math.sin(angle) * length * 0.55), fill=color, width=1)
    img.alpha_composite(masked(layer, rim.filter(ImageFilter.GaussianBlur(0.4))))


def draw_cliff_ink(img: Image.Image, cliff_mask: Image.Image, rng: random.Random) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    bbox = cliff_mask.getbbox() or (0, 0, WIDTH, HEIGHT)
    x0, y0, x1, y1 = bbox
    for _ in range(1200):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        if cliff_mask.getpixel((x, y)) == 0:
            continue
        length = rng.randrange(12, 96)
        sway = rng.uniform(-8, 8)
        d.line((x, y, x + sway, y + length), fill=(5, 6, 6, rng.randrange(54, 150)), width=1)
    img.alpha_composite(masked(layer, cliff_mask))


def add_vignette(img: Image.Image) -> None:
    alpha = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(alpha)
    d.rectangle((0, 0, WIDTH, HEIGHT), fill=210)
    for inset, value in ((70, 150), (180, 88), (340, 38)):
        d.rounded_rectangle((inset, inset // 2, WIDTH - inset, HEIGHT - inset // 2), radius=90, fill=value)
    img.alpha_composite(masked(Image.new("RGBA", img.size, (0, 0, 0, 170)), alpha))


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
