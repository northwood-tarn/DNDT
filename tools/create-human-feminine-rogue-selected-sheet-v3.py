from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
REVIEW_DIR = ROOT / "app/mini_preview/assets/pc_builder_production/body_head/review/weapon_fit_gallery"
SOURCE = REVIEW_DIR / "human_feminine_all_postures_rogue_weapons_v1.png"
FIGHTER_SWORD_SOURCE = REVIEW_DIR / "human_masculine_posture1_fighter_weapons_v2.png"
MACE_SOURCE = Path("/Users/jon/.codex/generated_images/019f137e-c16f-7730-ad49-dc9579587249/ig_042f51e90c563b00016a43924133808191b36fc66d361b3769.png")
OUT = REVIEW_DIR / "human_feminine_rogue_postures_selected_longsword_review_v3.png"
META = REVIEW_DIR / "human_feminine_rogue_postures_selected_longsword_review_v3.json"


GREEN = (0, 220, 20, 255)


def crop_cell(image: Image.Image, row: int, col: int, rows: int = 3, cols: int = 4) -> Image.Image:
    width, height = image.size
    cell_w = width // cols
    cell_h = height // rows
    x0 = col * cell_w
    y0 = row * cell_h
    x1 = (col + 1) * cell_w
    y1 = height if row == rows - 1 else (row + 1) * cell_h
    return image.crop((x0, y0, x1, y1))


def chroma_cutout(image: Image.Image, tolerance: int = 58) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            green_distance = abs(r - 0) + abs(g - 220) + abs(b - 20)
            greenish = g > 125 and g > r * 1.35 and g > b * 1.35
            if green_distance < tolerance or greenish:
                pixels[x, y] = (r, g, b, 0)
    alpha = image.getchannel("A").filter(ImageFilter.GaussianBlur(0.25))
    image.putalpha(alpha)
    return image


def trim_alpha(image: Image.Image, padding: int = 4) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.size[0], right + padding)
    bottom = min(image.size[1], bottom + padding)
    return image.crop((left, top, right, bottom))


def cover_polygon(cell: Image.Image, points: list[tuple[int, int]], blur: float = 0.5) -> None:
    patch = Image.new("RGBA", cell.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(patch)
    draw.polygon(points, fill=(0, 220, 20, 245))
    patch = patch.filter(ImageFilter.GaussianBlur(blur))
    cell.alpha_composite(patch)


def paste_shadowed(base: Image.Image, overlay: Image.Image, xy: tuple[int, int]) -> None:
    shadow = Image.new("RGBA", overlay.size, (0, 0, 0, 0))
    shadow.putalpha(overlay.getchannel("A").filter(ImageFilter.GaussianBlur(1.0)))
    tinted = Image.new("RGBA", overlay.size, (0, 0, 0, 70))
    tinted.putalpha(shadow.getchannel("A"))
    base.alpha_composite(tinted, (xy[0] + 2, xy[1] + 2))
    base.alpha_composite(overlay, xy)


def masked_crop(source: Image.Image, bbox: tuple[int, int, int, int], polygons: list[list[tuple[int, int]]], ellipses: list[tuple[int, int, int, int]] | None = None) -> Image.Image:
    crop = source.crop(bbox).convert("RGBA")
    mask = Image.new("L", crop.size, 0)
    draw = ImageDraw.Draw(mask)
    left, top, _, _ = bbox
    for polygon in polygons:
        draw.polygon([(x - left, y - top) for x, y in polygon], fill=255)
    for ellipse in ellipses or []:
        draw.ellipse((ellipse[0] - left, ellipse[1] - top, ellipse[2] - left, ellipse[3] - top), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    crop.putalpha(mask)
    return trim_alpha(crop, padding=2)


def build_sword_piece() -> Image.Image:
    fighter = Image.open(FIGHTER_SWORD_SOURCE).convert("RGBA")
    # Mask only the actual sword from the first fighter panel. This avoids dragging body pixels.
    sword = masked_crop(
        fighter,
        (70, 460, 430, 735),
        [
            # Blade
            [(128, 514), (405, 693), (388, 712), (109, 531)],
            # Hilt and guard
            [(83, 487), (151, 525), (143, 545), (75, 508)],
            [(101, 476), (132, 493), (119, 517), (91, 502)],
        ],
        ellipses=[(72, 485, 94, 506)],
    )
    sword = sword.resize((166, 127), Image.Resampling.LANCZOS)
    return sword


def build_mace_piece() -> Image.Image:
    mace_sheet = Image.open(MACE_SOURCE).convert("RGBA")
    # Mask only mace head and haft from the third panel study.
    mace = masked_crop(
        mace_sheet,
        (1120, 100, 1350, 430),
        [
            # Haft
            [(1190, 410), (1274, 188), (1288, 194), (1204, 416)],
        ],
        ellipses=[(1244, 96, 1338, 194)],
    )
    mace = mace.resize((56, 98), Image.Resampling.LANCZOS)
    # Angle it to match the row 3 col 2 hand/wrist.
    mace = mace.rotate(-18, expand=True, resample=Image.Resampling.BICUBIC)
    return mace


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    cell_w = source.size[0] // 4
    cell_h = source.size[1] // 3
    out = Image.new("RGBA", source.size, GREEN)

    for col in range(3):
        out.alpha_composite(crop_cell(source, 0, col), (col * cell_w, 0))
    for row in (1, 2):
        for col in range(3):
            out.alpha_composite(crop_cell(source, row, col), (col * cell_w, row * cell_h))

    longsword_cell = crop_cell(source, 0, 0)
    cover_polygon(longsword_cell, [(55, 200), (112, 181), (122, 200), (66, 232)], blur=0.5)
    sword = build_sword_piece()
    paste_shadowed(longsword_cell, sword, (43, 174))
    out.alpha_composite(longsword_cell, (3 * cell_w, 0))

    # Add mace to row 3 col 2, replacing the short nub while keeping the hand.
    mace = build_mace_piece()
    mace_cell_origin = (1 * cell_w, 2 * cell_h)
    # Cover the tiny blade/nub tip first; leave fingers intact.
    cover_area = Image.new("RGBA", out.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(cover_area)
    ox, oy = mace_cell_origin
    draw.polygon(
        [(ox + 218, oy + 112), (ox + 246, oy + 68), (ox + 254, oy + 75), (ox + 230, oy + 121)],
        fill=(0, 220, 20, 225),
    )
    cover_area = cover_area.filter(ImageFilter.GaussianBlur(0.5))
    out.alpha_composite(cover_area)
    paste_shadowed(out, mace, (ox + 214, oy + 48))

    out.convert("RGB").save(OUT)
    META.write_text(
        json.dumps(
            {
                "status": "review_composite",
                "productionArt": False,
                "sourceSheet": SOURCE.name,
                "output": OUT.name,
                "weaponDonors": {
                    "longsword": FIGHTER_SWORD_SOURCE.name,
                    "mace": str(MACE_SOURCE),
                },
                "layout": {
                    "row1": ["single_dagger", "dual_daggers", "crossbow", "longsword_raster_composite"],
                    "row2": ["single_dagger", "dual_daggers", "crossbow"],
                    "row3": ["single_dagger", "mace_raster_composite", "crossbow"],
                },
                "notes": [
                    "Uses raster weapon donors rather than code-drawn weapons.",
                    "Still a review composite only; do not register as production art.",
                ],
            },
            indent=2,
        )
        + "\n"
    )
    print(OUT)


if __name__ == "__main__":
    main()
