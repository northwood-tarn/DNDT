from collections import deque
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BASE_DIR = ROOT / "app" / "mini_preview" / "assets" / "base_combinations"

SHEET_PATH = BASE_DIR / "material_base_matrix_v1.png"
UNIQUE_REFERENCE_PATH = BASE_DIR / "betrayers_coin_reference.png"
SOURCE_ROW_DIR = BASE_DIR / "source_rows"

METALS = [
    "aged-gold",
    "dull-silver",
    "tarnished-brass",
    "dark-bronze",
    "gunmetal",
    "metallic-green",
    "deep-copper",
    "blackened-iron",
    "ember-warmed-steel",
]

CANVAS_SIZE = (192, 128)
MAX_BASE_SIZE = (168, 86)
BASELINE_Y = 106


def color_distance(a, b):
    return sum((int(a[i]) - int(b[i])) ** 2 for i in range(3)) ** 0.5


def flood_alpha_background(image, tolerance=34):
    """Remove only border-connected dark sheet background, preserving dark coins."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    samples = []
    for x in range(width):
        samples.append(pixels[x, 0][:3])
        samples.append(pixels[x, height - 1][:3])
    for y in range(height):
        samples.append(pixels[0, y][:3])
        samples.append(pixels[width - 1, y][:3])

    bg = tuple(int(sum(channel) / len(samples)) for channel in zip(*samples))
    seen = set()
    queue = deque()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or x < 0 or y < 0 or x >= width or y >= height:
            continue
        seen.add((x, y))

        if color_distance(pixels[x, y][:3], bg) > tolerance:
            continue

        pixels[x, y] = (pixels[x, y][0], pixels[x, y][1], pixels[x, y][2], 0)
        queue.append((x + 1, y))
        queue.append((x - 1, y))
        queue.append((x, y + 1))
        queue.append((x, y - 1))

    return rgba


def key_magenta_background(image):
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    for y in range(height):
        for x in range(width):
            r, g, b, _ = pixels[x, y]
            is_magenta = r > 130 and b > 130 and g < 155 and abs(int(r) - int(b)) < 150
            if is_magenta:
                pixels[x, y] = (r, g, b, 0)

    return rgba


def visible_components(image):
    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = alpha.size
    remaining = {
        (x, y)
        for y in range(height)
        for x in range(width)
        if pixels[x, y] > 0
    }

    components = []
    while remaining:
        start = remaining.pop()
        queue = deque([start])
        xs = [start[0]]
        ys = [start[1]]
        count = 1

        while queue:
            x, y = queue.popleft()
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if (nx, ny) in remaining:
                    remaining.remove((nx, ny))
                    queue.append((nx, ny))
                    xs.append(nx)
                    ys.append(ny)
                    count += 1

        bbox = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
        if count > 500 and bbox[2] - bbox[0] > 40 and bbox[3] - bbox[1] > 20:
            components.append({"bbox": bbox, "count": count})

    return sorted(components, key=lambda component: component["bbox"][0])


def isolate_central_foreground(image, tolerance=18):
    """Keep the main coin component in a grid cell and remove neighbor slivers."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    samples = []
    for x in range(width):
        samples.append(pixels[x, 0][:3])
        samples.append(pixels[x, height - 1][:3])
    for y in range(height):
        samples.append(pixels[0, y][:3])
        samples.append(pixels[width - 1, y][:3])

    bg = tuple(int(sum(channel) / len(samples)) for channel in zip(*samples))
    foreground = set()
    bg_brightness = sum(bg) / 3

    for y in range(height):
        for x in range(width):
            rgb = pixels[x, y][:3]
            brightness_gap = abs(sum(rgb) / 3 - bg_brightness)
            if color_distance(rgb, bg) > tolerance or brightness_gap > tolerance * 0.55:
                foreground.add((x, y))

    components = []
    while foreground:
        start = foreground.pop()
        queue = deque([start])
        component = [start]

        while queue:
            x, y = queue.popleft()
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if (nx, ny) in foreground:
                    foreground.remove((nx, ny))
                    queue.append((nx, ny))
                    component.append((nx, ny))

        if len(component) > 20:
            components.append(component)

    center = (width / 2, height / 2)

    def score(component):
        size = len(component)
        cx = sum(x for x, _ in component) / size
        cy = sum(y for _, y in component) / size
        distance = ((cx - center[0]) ** 2 + (cy - center[1]) ** 2) ** 0.5
        return size - distance * 16

    keep = set(max(components, key=score)) if components else set()

    for y in range(height):
        for x in range(width):
            if (x, y) not in keep:
                pixels[x, y] = (pixels[x, y][0], pixels[x, y][1], pixels[x, y][2], 0)

    return rgba


def alpha_bbox(image):
    alpha = image.getchannel("A")
    return alpha.getbbox()


def apply_base_footprint_mask(image):
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    cx = width / 2
    cy = 66
    rx = 86
    ry = 45

    for y in range(height):
        for x in range(width):
            nx = (x + 0.5 - cx) / rx
            ny = (y + 0.5 - cy) / ry
            inside = nx * nx + ny * ny <= 1
            # The front wall sits a little lower than the top ellipse.
            front_ny = (y + 0.5 - 78) / 33
            inside = inside or (nx * nx + front_ny * front_ny <= 1 and y > 54)

            if not inside:
                r, g, b, _ = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)

    return rgba


def blank_cell_edge_bands(image, width=18):
    rgb = image.convert("RGB")
    pixels = rgb.load()
    img_width, img_height = rgb.size

    samples = []
    for x in range(img_width):
        samples.append(pixels[x, 0])
        samples.append(pixels[x, img_height - 1])
    for y in range(img_height):
        samples.append(pixels[0, y])
        samples.append(pixels[img_width - 1, y])

    bg = tuple(int(sum(channel) / len(samples)) for channel in zip(*samples))

    for y in range(img_height):
        for x in range(width):
            pixels[x, y] = bg
            pixels[img_width - 1 - x, y] = bg

    return rgb


def normalize_base(image):
    bbox = alpha_bbox(image)
    if not bbox:
        raise ValueError("No visible pixels after background removal")

    trimmed = image.crop(bbox)
    scale = min(
        MAX_BASE_SIZE[0] / trimmed.width,
        MAX_BASE_SIZE[1] / trimmed.height,
        1.0,
    )
    resized = trimmed.resize(
        (round(trimmed.width * scale), round(trimmed.height * scale)),
        Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    x = (CANVAS_SIZE[0] - resized.width) // 2
    y = BASELINE_Y - resized.height
    canvas.alpha_composite(resized, (x, y))
    return apply_base_footprint_mask(canvas)


def export_grid():
    written = []
    for row, disc in enumerate(METALS):
        row_source = Image.open(SOURCE_ROW_DIR / f"row_disc-{disc}.png").convert("RGBA")
        keyed = key_magenta_background(row_source)
        components = visible_components(keyed)
        if len(components) != 9:
            raise ValueError(f"{disc} row produced {len(components)} components, expected 9")

        for rim, component in zip(METALS, components):
            left, top, right, bottom = component["bbox"]
            pad = 12
            cell = keyed.crop(
                (
                    max(0, left - pad),
                    max(0, top - pad),
                    min(keyed.width, right + pad),
                    min(keyed.height, bottom + pad),
                )
            )
            transparent = cell
            base = normalize_base(transparent)
            out = BASE_DIR / f"base_disc-{disc}_rim-{rim}.png"
            base.save(out)
            written.append(out)

    return written


def export_unique():
    reference = Image.open(UNIQUE_REFERENCE_PATH).convert("RGB")
    transparent = flood_alpha_background(reference, tolerance=36)
    base = normalize_base(transparent)
    out = BASE_DIR / "betrayers_coin.png"
    base.save(out)
    return out


def main():
    written = export_grid()
    unique = export_unique()
    metadata = {
        "canvas": {"width": CANVAS_SIZE[0], "height": CANVAS_SIZE[1]},
        "baseAnchor": {"x": CANVAS_SIZE[0] // 2, "y": BASELINE_Y},
        "normalBaseCount": len(written),
        "uniqueBases": [
            {
                "id": "betrayers-coin",
                "asset": "betrayers_coin.png",
                "baseAnchor": {"x": CANVAS_SIZE[0] // 2, "y": BASELINE_Y},
            }
        ],
        "normalBases": [
            {
                "disc": disc,
                "rim": rim,
                "asset": f"base_disc-{disc}_rim-{rim}.png",
                "baseAnchor": {"x": CANVAS_SIZE[0] // 2, "y": BASELINE_Y},
            }
            for disc in METALS
            for rim in METALS
        ],
    }
    (BASE_DIR / "base_asset_metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n"
    )
    print(f"wrote normal bases: {len(written)}")
    print(f"wrote unique base: {unique.relative_to(ROOT)}")
    print(f"wrote metadata: {(BASE_DIR / 'base_asset_metadata.json').relative_to(ROOT)}")
    print(f"canvas: {CANVAS_SIZE[0]}x{CANVAS_SIZE[1]}")
    print(f"base anchor: {CANVAS_SIZE[0] // 2},{BASELINE_Y}")


if __name__ == "__main__":
    main()
