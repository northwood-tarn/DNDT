from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
REVIEW_DIR = ROOT / "app/mini_preview/assets/pc_builder_production/body_head/review/weapon_fit_gallery"
SOURCE = REVIEW_DIR / "human_feminine_all_postures_rogue_weapons_v1.png"
OUT = REVIEW_DIR / "human_feminine_rogue_postures_selected_longsword_review_v2.png"
META = REVIEW_DIR / "human_feminine_rogue_postures_selected_longsword_review_v2.json"


def crop_cell(image: Image.Image, row: int, col: int, rows: int = 3, cols: int = 4) -> Image.Image:
    width, height = image.size
    cell_w = width // cols
    cell_h = height // rows
    x0 = col * cell_w
    y0 = row * cell_h
    x1 = (col + 1) * cell_w
    y1 = height if row == rows - 1 else (row + 1) * cell_h
    return image.crop((x0, y0, x1, y1))


def draw_longsword_on_posture_1(cell: Image.Image) -> Image.Image:
    cell = cell.copy()
    width, height = cell.size

    # Remove the short dagger blade while keeping the hand/grip silhouette.
    patch = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw_patch = ImageDraw.Draw(patch)
    draw_patch.polygon(
        [(56, 204), (104, 184), (113, 198), (66, 228)],
        fill=(0, 220, 20, 235),
    )
    patch = patch.filter(ImageFilter.GaussianBlur(0.5))
    cell.alpha_composite(patch)

    scale = 4
    sword = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sword)

    def s(point: tuple[float, float]) -> tuple[int, int]:
        return (round(point[0] * scale), round(point[1] * scale))

    def poly(points, fill, outline=None):
        draw.polygon([s(point) for point in points], fill=fill, outline=outline)

    def line(points, fill, width_px):
        draw.line([s(point) for point in points], fill=fill, width=width_px * scale)

    # Existing main hand is around x=104,y=199. Build the sword through that grip.
    guard_l = (91, 196)
    guard_r = (118, 207)
    blade_base_l = (98, 201)
    blade_base_r = (108, 207)
    tip = (32, 282)
    blade_mid = (52, 264)

    # Blade outline and bevel.
    poly(
        [blade_base_l, blade_base_r, (blade_mid[0] + 5, blade_mid[1] + 6), tip, (blade_mid[0] - 5, blade_mid[1] - 2)],
        fill=(36, 38, 37, 255),
    )
    poly(
        [(100, 202), (107, 206), (55, 267), (35, 280), (50, 262)],
        fill=(184, 190, 187, 255),
    )
    poly(
        [(102, 202), (107, 205), (56, 265), (39, 276), (53, 260)],
        fill=(232, 236, 232, 255),
    )
    line([(103, 203), (42, 276)], (95, 99, 98, 180), 1)

    # Crossguard, grip, pommel.
    line([guard_l, guard_r], (38, 29, 22, 255), 5)
    line([(94, 197), (116, 206)], (132, 106, 78, 255), 2)
    line([(107, 198), (121, 184)], (43, 31, 23, 255), 6)
    line([(108, 198), (119, 187)], (120, 84, 55, 255), 3)
    draw.ellipse(
        [s((117, 180)), s((126, 189))],
        fill=(47, 34, 25, 255),
        outline=(17, 14, 12, 255),
        width=scale,
    )

    sword = sword.resize((width, height), Image.Resampling.LANCZOS)
    cell.alpha_composite(sword)
    return cell


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    cell_w = source.size[0] // 4
    cell_h = source.size[1] // 3
    out = Image.new("RGBA", source.size, (0, 220, 20, 255))

    # Row 1: single dagger, dual daggers, crossbow, copied single dagger with longsword.
    for col in range(3):
        out.alpha_composite(crop_cell(source, 0, col), (col * cell_w, 0))
    longsword_cell = draw_longsword_on_posture_1(crop_cell(source, 0, 0))
    out.alpha_composite(longsword_cell, (3 * cell_w, 0))

    # Rows 2 and 3: first three columns only; fourth figures dropped.
    for row in (1, 2):
        for col in range(3):
            out.alpha_composite(crop_cell(source, row, col), (col * cell_w, row * cell_h))

    out.convert("RGB").save(OUT)
    META.write_text(
        json.dumps(
            {
                "status": "review_composite",
                "productionArt": False,
                "sourceSheet": SOURCE.name,
                "output": OUT.name,
                "layout": {
                    "row1": ["single_dagger", "dual_daggers", "crossbow", "longsword_review_composite"],
                    "row2": ["single_dagger", "dual_daggers", "crossbow"],
                    "row3": ["single_dagger", "dual_daggers", "crossbow"],
                },
                "dropped": ["row1_empty_hand", "row2_empty_hand", "row3_empty_hand"],
                "notes": [
                    "Existing rogue figures are cropped from the prior generated review sheet.",
                    "The row 1 longsword figure is a local review composite over a duplicate of row 1 figure 1.",
                    "This is not production art and must not be registered as a production asset.",
                ],
            },
            indent=2,
        )
        + "\n"
    )
    print(OUT)


if __name__ == "__main__":
    main()
