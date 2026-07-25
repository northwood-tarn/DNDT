from __future__ import annotations

import hashlib
import math
import random
import sys
from pathlib import Path

from PIL import Image


def blend(px, color, alpha):
    return tuple(round(a * (1 - alpha) + b * alpha) for a, b in zip(px[:3], color)) + (255,)


def segment_distance(x, y, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = dx * dx + dy * dy
    t = 0 if not length else max(0, min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length))
    return math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy))


def inside_polygon(x, y, points):
    inside = False
    j = len(points) - 1
    for i, a in enumerate(points):
        b = points[j]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
        j = i
    return inside


def star_points(cx, cy, outer, inner):
    return [
        (cx + math.cos(-math.pi / 2 + i * math.pi / 8) * (outer if i % 2 == 0 else inner),
         cy + math.sin(-math.pi / 2 + i * math.pi / 8) * (outer if i % 2 == 0 else inner))
        for i in range(16)
    ]


def paint_star(image, cx, cy, outer, inner, seed):
    rng = random.Random(seed)
    points = star_points(cx, cy, outer, inner)
    pixels = image.load()
    for y in range(max(0, int(cy - outer - 18)), min(image.height, int(cy + outer + 19))):
        for x in range(max(0, int(cx - outer - 18)), min(image.width, int(cx + outer + 19))):
            edge = min(segment_distance(x, y, points[i], points[(i + 1) % len(points)]) for i in range(len(points)))
            if inside_polygon(x, y, points):
                local = random.Random((x * 73856093) ^ (y * 19349663) ^ seed)
                if local.random() < 0.78 + 0.17 * rng.random():
                    pixels[x, y] = blend(pixels[x, y], (255, 248, 174), 0.62 + local.random() * 0.34)
            elif edge < 14:
                local = random.Random((x * 83492791) ^ (y * 297657976) ^ seed)
                pixels[x, y] = blend(pixels[x, y], (255, 222, 68), (1 - edge / 14) * 0.15 * local.random())
            if edge < 4:
                local = random.Random((x * 2654435761) ^ y ^ seed)
                if local.random() < 0.86:
                    pixels[x, y] = blend(pixels[x, y], (255, 255, 230), 0.82)


def paint_hand_star(image, cx, cy, outer, inner, seed):
    """Raster-paint an intentionally uneven, rough-hewn chalk star."""
    rng = random.Random(seed)
    points = []
    for i in range(16):
        angle = -math.pi / 2 + i * math.pi / 8 + rng.uniform(-0.045, 0.045)
        nominal = outer if i % 2 == 0 else inner
        radius = nominal * rng.uniform(0.84, 1.12)
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    pixels = image.load()
    pad = int(outer + 18)
    for y in range(max(0, int(cy) - pad), min(image.height, int(cy) + pad + 1)):
        for x in range(max(0, int(cx) - pad), min(image.width, int(cx) + pad + 1)):
            edge = min(segment_distance(x, y, points[i], points[(i + 1) % len(points)]) for i in range(len(points)))
            local = random.Random((x * 73856093) ^ (y * 19349663) ^ seed)
            if inside_polygon(x, y, points):
                # Uneven hand filling with dragged gaps and clumps.
                drag = random.Random((x // 6 * 83492791) ^ (y // 3 * 297657976) ^ seed)
                if local.random() < 0.70 + 0.22 * drag.random():
                    pixels[x, y] = blend(pixels[x, y], (246, 245, 238), 0.53 + 0.39 * local.random())
            elif edge < 7 and local.random() < 0.16:
                # Loose chalk crumbs make the silhouette ragged rather than polished.
                pixels[x, y] = blend(pixels[x, y], (242, 241, 233), 0.24 + 0.34 * local.random())
            if edge < 3.2 and local.random() < 0.58:
                pixels[x, y] = blend(pixels[x, y], (249, 248, 241), 0.46 + 0.30 * local.random())


def paint_line(image, points, thickness, seed):
    pixels = image.load()
    pad = int(thickness + 18)
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    for y in range(max(0, int(min(ys)) - pad), min(image.height, int(max(ys)) + pad + 1)):
        for x in range(max(0, int(min(xs)) - pad), min(image.width, int(max(xs)) + pad + 1)):
            distance = min(segment_distance(x, y, points[i], points[i + 1]) for i in range(len(points) - 1))
            local = random.Random((x * 73856093) ^ (y * 19349663) ^ seed)
            if distance <= thickness / 2 and local.random() < 0.91:
                pixels[x, y] = blend(pixels[x, y], (255, 248, 174), 0.60 + local.random() * 0.35)
            elif distance < thickness / 2 + 13:
                pixels[x, y] = blend(pixels[x, y], (255, 222, 68),
                                     (1 - (distance - thickness / 2) / 13) * 0.14 * local.random())


def paint_hand_dash(image, x1, x2, cy, thickness, seed):
    """Raster-paint a dragged chalk dash: irregular sides, square-ish broken ends, no geometric caps."""
    pixels = image.load()
    top = int(cy - thickness)
    bottom = int(cy + thickness)
    for y in range(top, bottom + 1):
        row_noise = random.Random((y * 19349663) ^ seed)
        left = x1 + row_noise.uniform(-8, 7)
        right = x2 + row_noise.uniform(-7, 8)
        for x in range(int(x1 - 15), int(x2 + 16)):
            t = max(0, min(1, (x - x1) / (x2 - x1)))
            local = random.Random((x * 73856093) ^ (y * 19349663) ^ seed)
            centre = cy + 3.2 * math.sin(t * math.pi * 3.1) + 2.2 * math.sin(t * math.pi * 8.7)
            half = thickness * (0.43 + 0.10 * math.sin(t * math.pi * 2.7) + 0.07 * (local.random() - 0.5))
            edge_noise = local.uniform(-3.5, 3.5)
            inside = left <= x <= right and abs(y - centre) <= half + edge_noise
            if inside:
                # Chalk body: dense but visibly dragged and locally broken.
                drag = random.Random((x // 5 * 83492791) ^ (y // 3 * 297657976) ^ seed)
                density = 0.72 + 0.20 * drag.random()
                if local.random() < density:
                    strength = 0.54 + 0.38 * local.random()
                    pixels[x, y] = blend(pixels[x, y], (246, 245, 238), strength)
            elif x1 - 10 <= x <= x2 + 10 and abs(y - centre) <= half + 8 and local.random() < 0.10:
                # Sparse crumbs along the ragged upper and lower profiles.
                pixels[x, y] = blend(pixels[x, y], (242, 241, 233), 0.30 + 0.30 * local.random())


def paint_hand_jagged_dash(image, points, thickness, seed):
    """Raster-paint a rough chalk zigzag with blunt, broken ends and uneven weight."""
    pixels = image.load()
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    pad = int(thickness + 14)
    for y in range(int(min(ys)) - pad, int(max(ys)) + pad + 1):
        row_noise = random.Random((y * 19349663) ^ seed)
        left = min(xs) + row_noise.uniform(-8, 7)
        right = max(xs) + row_noise.uniform(-7, 8)
        for x in range(int(min(xs)) - 15, int(max(xs)) + 16):
            local = random.Random((x * 73856093) ^ (y * 19349663) ^ seed)
            distance = min(segment_distance(x, y, points[i], points[i + 1]) for i in range(len(points) - 1))
            along = max(0, min(1, (x - min(xs)) / (max(xs) - min(xs))))
            half = thickness * (0.43 + 0.07 * math.sin(along * math.pi * 4.3) + 0.05 * (local.random() - 0.5))
            inside = left <= x <= right and distance <= half + local.uniform(-3.5, 3.5)
            if inside:
                drag = random.Random((x // 5 * 83492791) ^ (y // 3 * 297657976) ^ seed)
                if local.random() < 0.72 + 0.20 * drag.random():
                    pixels[x, y] = blend(pixels[x, y], (246, 245, 238), 0.54 + 0.38 * local.random())
            elif left - 8 <= x <= right + 8 and distance <= half + 8 and local.random() < 0.09:
                pixels[x, y] = blend(pixels[x, y], (242, 241, 233), 0.28 + 0.30 * local.random())


def save_pair(image, directory, name):
    image.save(directory / f"{name}.png")
    image.resize((80, 80), Image.Resampling.LANCZOS).save(directory / f"{name}_80.png")


def main():
    source_path, output_dir = Path(sys.argv[1]), Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)
    base = Image.open(source_path).convert("RGBA")
    w, h = base.size
    cx, symbol_y = w / 2, h * 0.735

    save_pair(base.copy(), output_dir, "divine_smite")

    radiant = base.copy()
    paint_hand_star(radiant, cx, h * 0.64, w * 0.115, w * 0.044, 101)
    save_pair(radiant, output_dir, "radiant_smite")

    x1, x2, thickness = w * 0.385, w * 0.615, w * 0.034
    blinding = base.copy()
    paint_hand_dash(blinding, x1, x2, h * 0.64, thickness, 211)
    save_pair(blinding, output_dir, "blinding_smite")

    staggering = base.copy()
    jagged_y = h * 0.64
    step = (x2 - x1) / 6
    jagged = [
        (x1, jagged_y),
        (x1 + step, jagged_y - 31),
        (x1 + step * 2, jagged_y + 27),
        (x1 + step * 3, jagged_y - 35),
        (x1 + step * 4, jagged_y + 22),
        (x1 + step * 5, jagged_y - 25),
        (x2, jagged_y),
    ]
    paint_hand_jagged_dash(staggering, jagged, thickness, 307)
    save_pair(staggering, output_dir, "staggering_smite")

    greater = radiant.copy()
    small = w * 0.115 * 0.30
    paint_hand_star(greater, w * 0.325, h * 0.64, small, small * 0.38, 401)
    paint_hand_star(greater, w * 0.675, h * 0.64, small, small * 0.38, 503)
    save_pair(greater, output_dir, "greater_radiant_smite")

    base_top = base.crop((0, 0, w, h // 2)).tobytes()
    for path in output_dir.glob("*.png"):
        if path.name.endswith("_80.png"):
            continue
        candidate = Image.open(path).convert("RGBA")
        assert candidate.crop((0, 0, w, h // 2)).tobytes() == base_top, f"base pixels changed in {path.name}"
    print("base_sha256", hashlib.sha256(source_path.read_bytes()).hexdigest())
    print("verified_upper_half_identical", 5)


if __name__ == "__main__":
    main()
