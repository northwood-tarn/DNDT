#!/usr/bin/env python3

import json
import shutil
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path("app/mini_preview/assets/pc_builder_production/body_head")
REVIEW = ROOT / "review"
OUT_ROOT = ROOT / "cutout/locked_weapon_pose_pool"
MANIFEST = ROOT / "metadata/locked_weapon_pose_pool.json"
CONTACT_SHEET = REVIEW / "locked_weapon_pose_pool_contact_sheet.png"

MARTIAL_SOURCE = REVIEW / "trimmed_pool/candidates"
DIVINE_SHEET = REVIEW / "cleric_weapon_matrix/human_feminine_cleric_weapon_matrix_2x3_attempt_04_crop_from_02.png"
ARCANE_SHEET = REVIEW / "arcane_pact_matrix/human_feminine_arcane_pact_matrix_3x3_attempt_02.png"

MARTIAL = [
    ("martial_01", "balanced_sword", "Balanced sword"),
    ("martial_02", "balanced_round_shield", "Balanced sword + round shield"),
    ("martial_03", "aggressive_sword", "Aggressive sword"),
    ("martial_04", "aggressive_square_shield", "Aggressive sword + square shield"),
    ("martial_05", "defensive_square_shield", "Defensive sword + square shield"),
    ("martial_06", "defensive_spear", "Defensive spear / polearm"),
    ("martial_07", "single_dagger", "Single dagger"),
    ("martial_08", "dual_daggers", "Dual daggers"),
    ("martial_09", "crossbow", "Crossbow"),
    ("martial_10", "aggressive_unarmed", "Aggressive unarmed"),
]

DIVINE = [
    ("divine_01", 0, 0, "Balanced greatshield + mace"),
    ("divine_02", 1, 0, "Balanced mace + holy symbol"),
    ("divine_03", 2, 0, "Balanced double-ended greatsword"),
    ("divine_04", 0, 1, "Aggressive greatshield + longsword"),
    ("divine_05", 1, 1, "Aggressive square shield + mace"),
    ("divine_06", 2, 1, "Aggressive holy symbol + empty hand"),
]

ARCANE = [
    ("arcane_01", 0, 0, "Balanced staff caster"),
    ("arcane_02", 1, 0, "Balanced body caster"),
    ("arcane_03", 2, 0, "Balanced hybrid staff carried"),
    ("arcane_04", 0, 1, "Aggressive mace + open spell hand"),
    ("arcane_05", 1, 1, "Aggressive body caster"),
    ("arcane_06", 2, 1, "Aggressive short blade + open spell hand"),
    ("arcane_07", 0, 2, "Defensive staff caster"),
    ("arcane_08", 1, 2, "Defensive body caster"),
    ("arcane_09", 2, 2, "Defensive hybrid staff carried"),
]


def main():
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    records = []
    records.extend(copy_martial())
    records.extend(extract_grid("divine", DIVINE_SHEET, 3, 2, DIVINE))
    records.extend(extract_grid("arcane", ARCANE_SHEET, 3, 3, ARCANE))
    write_manifest(records)
    write_contact_sheet(records)
    print(f"[locked-cutouts] wrote {len(records)} cutouts under {OUT_ROOT}")
    print(f"[locked-cutouts] wrote {MANIFEST}")
    print(f"[locked-cutouts] wrote {CONTACT_SHEET}")


def copy_martial():
    records = []
    group_dir = OUT_ROOT / "martial"
    group_dir.mkdir(parents=True, exist_ok=True)
    for asset_id, source_id, label in MARTIAL:
        src = MARTIAL_SOURCE / f"{source_id}.png"
        dst = group_dir / f"{asset_id}.png"
        image = trim_alpha(
            remove_small_alpha_islands(remove_green_matte(Image.open(src).convert("RGBA"))),
            pad=12,
        )
        image.save(dst)
        records.append(record("martial", asset_id, label, dst, src, source_id=source_id))
    return records


def extract_grid(group, sheet_path, cols, rows, specs):
    image = Image.open(sheet_path).convert("RGBA")
    group_dir = OUT_ROOT / group
    group_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for asset_id, col, row, label in specs:
        cell = crop_cell(image, cols, rows, col, row)
        cutout = trim_alpha(remove_small_alpha_islands(remove_green_matte(cell)), pad=14)
        dst = group_dir / f"{asset_id}.png"
        cutout.save(dst)
        records.append(record(group, asset_id, label, dst, sheet_path, row=row + 1, col=col + 1))
    return records


def crop_cell(image, cols, rows, col, row):
    width = image.width / cols
    height = image.height / rows
    left = round(col * width)
    top = round(row * height)
    right = round((col + 1) * width)
    bottom = round((row + 1) * height)
    return image.crop((left, top, right, bottom))


def remove_green_matte(image):
    image = chroma_key_green(image)
    image = despill_green(image)
    image = remove_green_edge_alpha(image)
    return image


def chroma_key_green(image):
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            high_green = g > 95 and g > r * 1.08 and g > b * 1.08
            saturated_green = g > 135 and r < 145 and b < 155
            green_excess = g - max(r, b)
            if high_green or saturated_green or green_excess > 30:
                strength = max(
                    min(1.0, max(0, green_excess - 12) / 70),
                    min(1.0, max(0, g - 95) / 105),
                )
                if saturated_green or green_excess > 58:
                    strength = 1.0
                pixels[x, y] = (r, g, b, int(a * (1.0 - strength)))
    return image


def despill_green(image):
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            target_g = max(r, b)
            green_excess = g - target_g
            if green_excess > 4:
                # Keep a small neutral allowance so olive/shadow tones do not flatten.
                pixels[x, y] = (r, min(g, target_g + 4), b, a)
    return image


def remove_green_edge_alpha(image):
    alpha = image.getchannel("A")
    edge_alpha = alpha.filter(ImageFilter.MinFilter(3))
    alpha_pixels = alpha.load()
    edge_pixels = edge_alpha.load()
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            green_excess = g - max(r, b)
            if edge_pixels[x, y] <= 12 and green_excess > 0:
                pixels[x, y] = (r, g, b, 0)
            elif edge_pixels[x, y] <= 36 and green_excess > 2:
                alpha_pixels[x, y] = max(0, a - min(180, green_excess * 10))
    image.putalpha(alpha)
    return image


def trim_alpha(image, pad=0):
    bbox = image.getbbox()
    if not bbox:
        return image
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(image.width, bbox[2] + pad)
    bottom = min(image.height, bbox[3] + pad)
    return image.crop((left, top, right, bottom))


def remove_small_alpha_islands(image, min_pixels=240):
    alpha = image.getchannel("A")
    alpha_pixels = alpha.load()
    image_pixels = image.load()
    seen = set()
    for y in range(image.height):
        for x in range(image.width):
            if alpha_pixels[x, y] <= 8 or (x, y) in seen:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            component = []
            while stack:
                cx, cy = stack.pop()
                component.append((cx, cy))
                for nx in (cx - 1, cx, cx + 1):
                    for ny in (cy - 1, cy, cy + 1):
                        if nx < 0 or ny < 0 or nx >= image.width or ny >= image.height:
                            continue
                        if (nx, ny) in seen or alpha_pixels[nx, ny] <= 8:
                            continue
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            if len(component) < min_pixels:
                for px, py in component:
                    r, g, b, _ = image_pixels[px, py]
                    image_pixels[px, py] = (r, g, b, 0)
    return image


def record(group, asset_id, label, dst, source, **extra):
    image = Image.open(dst).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    visible_pixels = sum(1 for value in alpha.tobytes() if value > 8)
    return {
        "id": asset_id,
        "group": group,
        "label": label,
        "status": "review_cutout",
        "productionArt": False,
        "asset": str(dst),
        "source": str(source),
        "canvas": {"width": image.width, "height": image.height},
        "alphaBounds": None if not bbox else {
            "left": bbox[0],
            "top": bbox[1],
            "right": bbox[2],
            "bottom": bbox[3],
            "width": bbox[2] - bbox[0],
            "height": bbox[3] - bbox[1],
        },
        "visiblePixels": visible_pixels,
        "tags": [group],
        **extra,
    }


def write_manifest(records):
    groups = {}
    for item in records:
        groups.setdefault(item["group"], []).append(item["id"])
    MANIFEST.write_text(json.dumps({
        "status": "review_cutout_manifest",
        "productionArt": False,
        "assetRoot": str(OUT_ROOT),
        "groups": groups,
        "filterGroups": ["martial", "divine", "arcane"],
        "records": records,
        "notes": [
            "These are review-derived transparent PNG cutouts from locked sheets.",
            "They are intended for scroll/filter UI and base-fit review before production promotion.",
            "They are not yet registered as production layer assets.",
        ],
    }, indent=2) + "\n")


def write_contact_sheet(records):
    thumbs = []
    for item in records:
        image = Image.open(item["asset"]).convert("RGBA")
        image.thumbnail((132, 160), Image.Resampling.LANCZOS)
        thumbs.append((item, image.copy()))

    cols = 7
    cell_w = 166
    cell_h = 210
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), (18, 22, 21))
    for index, (item, image) in enumerate(thumbs):
        col = index % cols
        row = index // cols
        x = col * cell_w
        y = row * cell_h
        panel = Image.new("RGB", (cell_w - 8, cell_h - 8), (27, 32, 30))
        sheet.paste(panel, (x + 4, y + 4))
        px = x + (cell_w - image.width) // 2
        py = y + 22 + (150 - image.height) // 2
        sheet.paste(image, (px, py), image)
        draw_label(sheet, item["id"], x + 10, y + 176)
    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET)


def draw_label(sheet, text, x, y):
    # Keep this dependency-light; labels are for quick ID review only.
    from PIL import ImageDraw, ImageFont

    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    draw.text((x, y), text, fill=(224, 218, 194), font=font)


if __name__ == "__main__":
    main()
