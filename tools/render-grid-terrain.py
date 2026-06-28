#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


WIDTH = 1920
HEIGHT = 1080


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: render-grid-terrain.py <grid.json> <out.png>", file=sys.stderr)
        return 1

    grid_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    data = json.loads(grid_path.read_text())
    render(data).save(out_path)
    print(out_path)
    return 0


def render(data: dict) -> Image.Image:
    rng = random.Random(stable_seed(data.get("stageId", "stage")))
    grid = data["grid"]
    cells = build_cell_index(data)

    img = Image.new("RGBA", (WIDTH, HEIGHT), (4, 6, 7, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    draw_void_wash(draw, rng)

    draw_cliff_faces(img, cells, grid, rng)
    draw_region_surfaces(img, cells, grid, rng)
    draw_height_edges(img, cells, grid, rng)
    draw_organic_dressing(img, cells, grid, rng)
    draw_vignette(img)
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
        # Base terrain leaves cover footprints as plain standable/reserved ground.
        cells[(cover["x"], cover["y"])].update(cover=cover, walkable=True, blocked=False, reserved=True)
    for feature in data.get("features", []):
        # Base terrain leaves feature footprints as plain standable/reserved ground.
        cells[(feature["x"], feature["y"])].update(feature=feature, walkable=True, blocked=False, reserved=True)
    return cells


def draw_void_wash(draw: ImageDraw.ImageDraw, rng: random.Random) -> None:
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=(3, 5, 6, 255))
    for _ in range(260):
        x = rng.randrange(WIDTH)
        y = rng.randrange(HEIGHT)
        r = rng.randrange(36, 150)
        shade = rng.randrange(5, 20)
        alpha = rng.randrange(8, 28)
        draw.ellipse((x - r, y - r // 2, x + r, y + r // 2), fill=(shade, shade + 2, shade + 3, alpha))


def draw_region_surfaces(img: Image.Image, cells: dict[tuple[int, int], dict], grid: dict, rng: random.Random) -> None:
    for material, region in connected_regions(cells, grid):
        mask = region_mask(region, grid)
        region_rng = random.Random(stable_seed(f"{material}:{region[0]['x']},{region[0]['y']}:{len(region)}"))
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer, "RGBA")
        bbox = expanded_bbox(mask.getbbox(), 80)
        base = material_color(material)

        ld.rectangle(bbox, fill=base)
        draw_broad_lighting(layer, bbox, material, region_rng)
        draw_ground_mottle(layer, bbox, base, region_rng)
        draw_ground_strata(layer, bbox, material, region_rng)
        layer = layer.filter(ImageFilter.GaussianBlur(0.45))

        clipped = Image.composite(layer, Image.new("RGBA", img.size, (0, 0, 0, 0)), mask)
        img.alpha_composite(clipped)

        interior = mask.filter(ImageFilter.MinFilter(9))
        edge_band = ImageChops.subtract(mask, interior)
        dress_region_edges(img, edge_band, bbox, material, region_rng)


def connected_regions(cells: dict[tuple[int, int], dict], grid: dict) -> list[tuple[str, list[dict]]]:
    seen: set[tuple[int, int]] = set()
    regions: list[tuple[str, list[dict]]] = []
    for y in range(grid["height"]):
        for x in range(grid["width"]):
            cell = cells[(x, y)]
            if not is_drawable(cell) or (x, y) in seen:
                continue
            material = material_key(cell)
            queue = [(x, y)]
            seen.add((x, y))
            region: list[dict] = []
            while queue:
                cx, cy = queue.pop(0)
                current = cells[(cx, cy)]
                region.append(current)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    neighbor = cells.get((nx, ny))
                    if not neighbor or (nx, ny) in seen or not is_drawable(neighbor):
                        continue
                    if material_key(neighbor) != material:
                        continue
                    seen.add((nx, ny))
                    queue.append((nx, ny))
            regions.append((material, region))
    return regions


def region_mask(region: list[dict], grid: dict) -> Image.Image:
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    md = ImageDraw.Draw(mask)
    for cell in region:
        md.polygon(diamond(cell["x"], cell["y"], grid), fill=255)
    return mask


def draw_broad_lighting(layer: Image.Image, bbox: tuple[int, int, int, int], material: str, rng: random.Random) -> None:
    d = ImageDraw.Draw(layer, "RGBA")
    x0, y0, x1, y1 = bbox
    width = x1 - x0
    height = y1 - y0
    warm = (142, 122, 78, 34) if material in ("high", "slope") else (104, 125, 87, 26)
    cool = (8, 12, 13, 42)
    for _ in range(18):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        rx = rng.randrange(max(28, width // 10), max(40, width // 3))
        ry = rng.randrange(max(12, height // 10), max(20, height // 3))
        d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=warm)
    for _ in range(14):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        rx = rng.randrange(max(24, width // 12), max(38, width // 3))
        ry = rng.randrange(max(10, height // 12), max(18, height // 3))
        d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=cool)
    layer.alpha_composite(layer.filter(ImageFilter.GaussianBlur(10)))


def draw_ground_mottle(layer: Image.Image, bbox: tuple[int, int, int, int], base: tuple[int, int, int, int], rng: random.Random) -> None:
    d = ImageDraw.Draw(layer, "RGBA")
    x0, y0, x1, y1 = bbox
    for _ in range(900):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        rx = rng.uniform(0.7, 4.8)
        ry = rng.uniform(0.35, 1.9)
        delta = rng.randrange(-28, 31)
        alpha = rng.randrange(18, 82)
        color = clamp_color((base[0] + delta, base[1] + delta, base[2] + delta, alpha))
        d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=color)


def draw_ground_strata(layer: Image.Image, bbox: tuple[int, int, int, int], material: str, rng: random.Random) -> None:
    d = ImageDraw.Draw(layer, "RGBA")
    x0, y0, x1, y1 = bbox
    ink = (18, 22, 20, 64) if material != "high" else (30, 27, 23, 72)
    highlight = (150, 133, 84, 58) if material == "high" else (103, 126, 83, 46)
    for _ in range(90):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        length = rng.randrange(18, 130)
        angle = rng.uniform(-0.55, 0.25)
        color = ink if rng.random() < 0.72 else highlight
        width = 1 if rng.random() < 0.82 else 2
        d.line((x, y, x + math.cos(angle) * length, y + math.sin(angle) * length * 0.55), fill=color, width=width)


def dress_region_edges(img: Image.Image, edge_band: Image.Image, bbox: tuple[int, int, int, int], material: str, rng: random.Random) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    x0, y0, x1, y1 = bbox
    color = (128, 112, 72, 92) if material == "high" else (76, 88, 66, 86)
    dark = (10, 13, 13, 102)
    for _ in range(420):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        if edge_band.getpixel((x, y)) == 0:
            continue
        length = rng.randrange(3, 16)
        angle = rng.choice((-0.45, 0.45, 2.7, -2.7)) + rng.uniform(-0.15, 0.15)
        d.line((x, y, x + math.cos(angle) * length, y + math.sin(angle) * length * 0.65), fill=color if rng.random() < 0.6 else dark, width=1)
    img.alpha_composite(Image.composite(layer, Image.new("RGBA", img.size, (0, 0, 0, 0)), edge_band))


def is_drawable(cell: dict) -> bool:
    return not cell["blocked"] or cell.get("reserved")


def material_key(cell: dict) -> str:
    if cell.get("slope"):
        return "slope"
    if cell["altitude"] >= 4:
        return "high"
    if cell["altitude"] > 0:
        return "mid"
    return "low"


def material_color(material: str) -> tuple[int, int, int, int]:
    if material == "slope":
        return (63, 78, 52, 255)
    if material == "high":
        return (77, 64, 45, 255)
    if material == "mid":
        return (61, 65, 48, 255)
    return (42, 54, 45, 255)


def expanded_bbox(bbox: tuple[int, int, int, int] | None, padding: int) -> tuple[int, int, int, int]:
    if bbox is None:
        return (0, 0, WIDTH, HEIGHT)
    x0, y0, x1, y1 = bbox
    return (max(0, x0 - padding), max(0, y0 - padding), min(WIDTH, x1 + padding), min(HEIGHT, y1 + padding))


def draw_cliff_faces(img: Image.Image, cells: dict[tuple[int, int], dict], grid: dict, rng: random.Random) -> None:
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(grid["height"]):
        for x in range(grid["width"]):
            cell = cells[(x, y)]
            if cell["blocked"] and not cell.get("reserved"):
                continue
            h = cell["altitude"]
            for nx, ny, side in ((x + 1, y, "right"), (x, y + 1, "left")):
                neighbor = cells.get((nx, ny))
                if neighbor and not neighbor["blocked"]:
                    drop = max(0, h - neighbor["altitude"])
                else:
                    drop = max(1, h + 1) if h > 0 or not neighbor else 1
                if drop <= 0:
                    continue
                edge = cell_edge(x, y, grid, side)
                depth = min(150, 30 + drop * 28)
                face = [edge[0], edge[1], (edge[1][0], edge[1][1] + depth), (edge[0][0], edge[0][1] + depth)]
                shade = (21, 24, 23, 205) if side == "right" else (12, 15, 15, 215)
                draw.polygon(face, fill=shade)
                for i in range(6 + drop * 2):
                    t = (i + 1) / (7 + drop * 2)
                    sx = edge[0][0] + (edge[1][0] - edge[0][0]) * t
                    sy = edge[0][1] + (edge[1][1] - edge[0][1]) * t
                    draw.line((sx, sy + 2, sx + rng.uniform(-8, 8), sy + depth * rng.uniform(0.45, 0.95)), fill=(56, 52, 44, 90), width=1)


def draw_height_edges(img: Image.Image, cells: dict[tuple[int, int], dict], grid: dict, rng: random.Random) -> None:
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(grid["height"]):
        for x in range(grid["width"]):
            cell = cells[(x, y)]
            if cell["blocked"] and not cell.get("reserved"):
                continue
            for nx, ny, side in ((x + 1, y, "right"), (x, y + 1, "left")):
                neighbor = cells.get((nx, ny))
                if not neighbor or neighbor["blocked"] or neighbor["altitude"] != cell["altitude"]:
                    edge = cell_edge(x, y, grid, side)
                    draw.line(edge, fill=(122, 112, 83, 48), width=2)
                    for _ in range(5):
                        t = rng.random()
                        px = edge[0][0] + (edge[1][0] - edge[0][0]) * t
                        py = edge[0][1] + (edge[1][1] - edge[0][1]) * t
                        draw.ellipse((px - 2, py - 1, px + 2, py + 1), fill=(150, 135, 92, 42))


def draw_organic_dressing(img: Image.Image, cells: dict[tuple[int, int], dict], grid: dict, rng: random.Random) -> None:
    terrain = all_terrain_mask(cells, grid)
    eroded = terrain.filter(ImageFilter.MinFilter(21))
    rim = ImageChops.subtract(terrain, eroded)

    draw_rim_debris(img, rim, rng)
    draw_cross_region_scars(img, terrain, rng)
    draw_void_fog(img, terrain, rng)


def all_terrain_mask(cells: dict[tuple[int, int], dict], grid: dict) -> Image.Image:
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    d = ImageDraw.Draw(mask)
    for cell in cells.values():
        if is_drawable(cell):
            d.polygon(diamond(cell["x"], cell["y"], grid), fill=255)
    return mask


def draw_rim_debris(img: Image.Image, rim: Image.Image, rng: random.Random) -> None:
    bbox = expanded_bbox(rim.getbbox(), 18)
    x0, y0, x1, y1 = bbox
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    for _ in range(1100):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        if rim.getpixel((x, y)) == 0:
            continue
        length = rng.randrange(4, 22)
        angle = rng.uniform(-0.9, 0.9)
        if rng.random() < 0.5:
            angle += math.pi
        color = (9, 12, 12, rng.randrange(70, 150)) if rng.random() < 0.68 else (128, 111, 72, rng.randrange(32, 90))
        d.line((x, y, x + math.cos(angle) * length, y + math.sin(angle) * length * 0.55), fill=color, width=1)
    img.alpha_composite(Image.composite(layer, Image.new("RGBA", img.size, (0, 0, 0, 0)), rim))


def draw_cross_region_scars(img: Image.Image, terrain: Image.Image, rng: random.Random) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    bbox = expanded_bbox(terrain.getbbox(), 0)
    x0, y0, x1, y1 = bbox
    for _ in range(62):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        if terrain.getpixel((x, y)) == 0:
            continue
        points = [(x, y)]
        angle = rng.uniform(-0.55, 0.25)
        steps = rng.randrange(3, 8)
        for _step in range(steps):
            px, py = points[-1]
            length = rng.randrange(18, 54)
            angle += rng.uniform(-0.22, 0.22)
            points.append((px + math.cos(angle) * length, py + math.sin(angle) * length * 0.55))
        color = (5, 8, 8, rng.randrange(72, 132)) if rng.random() < 0.7 else (99, 121, 73, rng.randrange(32, 70))
        d.line(points, fill=color, width=1 if rng.random() < 0.82 else 2, joint="curve")
    clipped = Image.composite(layer, Image.new("RGBA", img.size, (0, 0, 0, 0)), terrain)
    img.alpha_composite(clipped)


def draw_void_fog(img: Image.Image, terrain: Image.Image, rng: random.Random) -> None:
    void = ImageChops.invert(terrain)
    terrain_blur = terrain.filter(ImageFilter.GaussianBlur(18))
    near_void = ImageChops.multiply(void, terrain_blur)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    for _ in range(72):
        x = rng.randrange(0, WIDTH)
        y = rng.randrange(90, HEIGHT - 20)
        rx = rng.randrange(46, 190)
        ry = rng.randrange(10, 42)
        d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(20, 24, 22, rng.randrange(18, 52)))
    layer = layer.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(Image.composite(layer, Image.new("RGBA", img.size, (0, 0, 0, 0)), near_void))


def draw_vignette(img: Image.Image) -> None:
    vignette = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(vignette)
    d.rectangle((0, 0, WIDTH, HEIGHT), fill=210)
    for inset, alpha in ((80, 160), (180, 100), (320, 55)):
        d.rounded_rectangle((inset, inset // 2, WIDTH - inset, HEIGHT - inset // 2), radius=80, fill=alpha)
    dark = Image.new("RGBA", img.size, (0, 0, 0, 185))
    img.alpha_composite(Image.composite(dark, Image.new("RGBA", img.size, (0, 0, 0, 0)), vignette))


def surface_color(cell: dict) -> tuple[int, int, int, int]:
    if cell.get("slope"):
        return (76, 89, 61, 255)
    if cell["altitude"] >= 4:
        return (92, 76, 52, 255)
    if cell["altitude"] > 0:
        return (79, 78, 57, 255)
    return (54, 63, 52, 255)


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


def point_in_poly(point: tuple[float, float], poly: list[tuple[float, float]]) -> bool:
    x, y = point
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / max(0.000001, yj - yi) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside


def clamp_color(color: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return tuple(max(0, min(255, round(channel))) for channel in color)


if __name__ == "__main__":
    raise SystemExit(main())
