#!/usr/bin/env python3

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path("app/mini_preview/assets/pc_builder_production/body_head/review")
SOURCE_ROOT = ROOT / "weapon_fit_gallery"
OUT_DIR = ROOT / "trimmed_pool"
CANDIDATE_DIR = OUT_DIR / "candidates"
OUT = OUT_DIR / "humanoid_trimmed_pool_species_contact_sheet.png"
META = OUT_DIR / "humanoid_trimmed_pool_species_contact_sheet.json"

SOURCES = {
    "p1_fighter": SOURCE_ROOT / "human_masculine_posture1_fighter_weapons_v2.png",
    "p2_fighter": SOURCE_ROOT / "human_masculine_posture2_fighter_weapons_v3.png",
    "p3_fighter": SOURCE_ROOT / "human_masculine_posture3_fighter_weapons_v2.png",
    "rogue": SOURCE_ROOT / "human_feminine_all_postures_rogue_weapons_v1.png",
}

CANDIDATES = [
    {"id": "balanced_sword", "label": "Balanced\nsword", "source": "p1_fighter", "cols": 4, "rows": 1, "col": 0, "row": 0},
    {"id": "balanced_round_shield", "label": "Balanced\nround shield", "source": "p1_fighter", "cols": 4, "rows": 1, "col": 1, "row": 0},
    {"id": "aggressive_sword", "label": "Aggressive\nsword", "source": "p2_fighter", "cols": 4, "rows": 1, "col": 0, "row": 0},
    {"id": "aggressive_square_shield", "label": "Aggressive\nsquare shield", "source": "p2_fighter", "cols": 4, "rows": 1, "col": 1, "row": 0},
    {"id": "defensive_square_shield", "label": "Defensive\nsquare shield", "source": "p3_fighter", "cols": 4, "rows": 1, "col": 1, "row": 0},
    {"id": "defensive_spear", "label": "Defensive\nspear", "source": "p3_fighter", "cols": 4, "rows": 1, "col": 3, "row": 0},
    {"id": "single_dagger", "label": "Single\ndagger", "source": "rogue", "cols": 4, "rows": 3, "col": 0, "row": 0},
    {"id": "dual_daggers", "label": "Dual\ndaggers", "source": "rogue", "cols": 4, "rows": 3, "col": 1, "row": 0},
    {"id": "crossbow", "label": "Crossbow", "source": "rogue", "cols": 4, "rows": 3, "col": 2, "row": 0},
    {
        "id": "aggressive_unarmed",
        "label": "Aggressive\nunarmed",
        "source": "rogue",
        "cols": 4,
        "rows": 3,
        "col": 0,
        "row": 2,
        "note": "Rogue posture 3, first image.",
    },
]

SPECIES = [
    {"id": "human", "label": "Human", "scale": 1.00, "tint": None, "opacity": 0.0},
    {"id": "aasimar", "label": "Aasimar", "scale": 1.00, "tint": (230, 234, 228), "opacity": 0.18},
    {"id": "elf", "label": "Elf", "scale": 1.04, "tint": (196, 214, 196), "opacity": 0.10},
    {"id": "dwarf", "label": "Dwarf", "scale": 0.80, "tint": (190, 174, 150), "opacity": 0.10},
    {"id": "gnome", "label": "Gnome", "scale": 0.58, "tint": (184, 184, 205), "opacity": 0.12},
    {"id": "halfling", "label": "Halfling", "scale": 0.58, "tint": (196, 178, 142), "opacity": 0.12},
    {"id": "dragonborn", "label": "Dragonborn", "scale": 1.06, "tint": (80, 118, 84), "opacity": 0.28},
    {"id": "goliath", "label": "Goliath", "scale": 1.18, "tint": (176, 174, 170), "opacity": 0.12},
    {"id": "tiefling", "label": "Tiefling", "scale": 1.00, "tint": (128, 70, 128), "opacity": 0.24},
]

COLORS = {
    "bg": (16, 20, 19),
    "panel": (25, 29, 28),
    "panel_alt": (30, 34, 33),
    "stroke": (62, 69, 65),
    "text": (224, 218, 194),
    "muted": (156, 153, 132),
}

CELL_W = 168
CELL_H = 194
LEFT = 148
TOP = 112
SHEET_W = LEFT + CELL_W * len(CANDIDATES) + 24
SHEET_H = TOP + CELL_H * len(SPECIES) + 24


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


FONT_TITLE = font(24, True)
FONT_HEAD = font(14, True)
FONT_BODY = font(13)
FONT_SMALL = font(11)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)
    sources = {key: Image.open(path).convert("RGBA") for key, path in SOURCES.items()}
    candidates = []
    for spec in CANDIDATES:
        image = extract_candidate(sources[spec["source"]], spec)
        image.save(CANDIDATE_DIR / f"{spec['id']}.png")
        candidates.append({**spec, "image": image})

    sheet = Image.new("RGB", (SHEET_W, SHEET_H), COLORS["bg"])
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 18), "Trimmed humanoid armed pool - species scale/tint review", fill=COLORS["text"], font=FONT_TITLE)
    draw.text(
        (20, 50),
        "Proxy only: gender is held constant; species-specific body/head art is not final.",
        fill=COLORS["muted"],
        font=FONT_BODY,
    )

    for col, candidate in enumerate(candidates):
        x = LEFT + col * CELL_W
        draw_multiline_centered(draw, candidate["label"], x + CELL_W / 2 - 4, 76, COLORS["text"], FONT_HEAD, line_gap=2)

    for row, species in enumerate(SPECIES):
        y = TOP + row * CELL_H
        panel = COLORS["panel_alt"] if row % 2 else COLORS["panel"]
        draw.rectangle((16, y, LEFT - 18, y + CELL_H - 10), fill=panel, outline=COLORS["stroke"])
        draw.text((30, y + 24), species["label"], fill=COLORS["text"], font=FONT_HEAD)
        draw.text((30, y + 46), f"scale {species['scale']:.2f}", fill=COLORS["muted"], font=FONT_SMALL)

        for col, candidate in enumerate(candidates):
            x = LEFT + col * CELL_W
            draw.rectangle((x, y, x + CELL_W - 10, y + CELL_H - 10), fill=panel, outline=COLORS["stroke"])
            draw_candidate(sheet, candidate["image"], species, x, y)

    sheet.save(OUT)
    META.write_text(json.dumps({
        "status": "review_contact_sheet",
        "productionArt": False,
        "output": str(OUT),
        "candidateCutouts": str(CANDIDATE_DIR),
        "note": "Species variants are proxy scale/tint reviews only. Gender is intentionally held aside.",
        "candidates": [{k: v for k, v in candidate.items() if k != "image"} for candidate in candidates],
        "species": SPECIES,
    }, indent=2) + "\n")
    print(f"[trimmed-pool] wrote {OUT}")
    print(f"[trimmed-pool] wrote {META}")


def extract_candidate(sheet, spec):
    cell_w = sheet.width // spec["cols"]
    cell_h = sheet.height // spec["rows"]
    box = (
        spec["col"] * cell_w,
        spec["row"] * cell_h,
        (spec["col"] + 1) * cell_w,
        (spec["row"] + 1) * cell_h,
    )
    cell = sheet.crop(box)
    keyed = chroma_key_green(cell)
    bounds = keyed.getbbox()
    if not bounds:
        return keyed
    pad = 22
    left = max(0, bounds[0] - pad)
    top = max(0, bounds[1] - pad)
    right = min(keyed.width, bounds[2] + pad)
    bottom = min(keyed.height, bounds[3] + pad)
    return keyed.crop((left, top, right, bottom))


def chroma_key_green(image):
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            green_dominant = g > 105 and g > r * 1.18 and g > b * 1.18
            saturated_green = g > 145 and r < 125 and b < 145
            if green_dominant or saturated_green:
                pixels[x, y] = (r, g, b, 0)
    return image


def draw_candidate(sheet, image, species, cell_x, cell_y):
    max_w = CELL_W - 36
    max_h = CELL_H - 34
    base_scale = min(max_w / image.width, max_h / image.height)
    scale = min(base_scale * species["scale"], max_w / image.width, max_h / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    rendered = image.resize(size, Image.Resampling.LANCZOS)
    rendered = tint_image(rendered, species["tint"], species["opacity"])
    x = round(cell_x + (CELL_W - 10 - rendered.width) / 2)
    y = round(cell_y + CELL_H - 22 - rendered.height)
    sheet.paste(rendered, (x, y), rendered)


def tint_image(image, tint, opacity):
    if not tint or opacity <= 0:
        return image
    overlay = Image.new("RGBA", image.size, (*tint, 0))
    alpha = image.getchannel("A").point(lambda value: round(value * opacity))
    overlay.putalpha(alpha)
    return Image.alpha_composite(image, overlay)


def draw_multiline_centered(draw, text, center_x, y, fill, font_obj, line_gap=0):
    lines = text.split("\n")
    current_y = y
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font_obj)
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        draw.text((round(center_x - width / 2), current_y), line, fill=fill, font=font_obj)
        current_y += height + line_gap


if __name__ == "__main__":
    main()
