#!/usr/bin/env python3
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "app/mini_preview/assets/pc_builder_production"
BODY_ROOT = ASSET_ROOT / "human_feminine"
HAIR_ROOT = ASSET_ROOT / "hair"

BODY_HEAD_ANCHORS = {
    "posture_1": (705, 173),
    "posture_2": (786, 191),
    "posture_3": (745, 180),
}

STYLE_SCALES = {
    "short_messy": 0.19,
    "short_severe": 0.19,
    "long_loose": 0.15,
    "scruffy_shoulder_length": 0.15,
    "long_tied_back": 0.15,
    "topknot_bun": 0.17,
    "bald_or_shaved": 0.17,
    "scruffy_short": 0.19,
}

STYLE_OFFSETS = {
    "short_messy": (-20, -15),
    "short_severe": (-20, -15),
    "long_loose": (-20, 0),
    "scruffy_shoulder_length": (-20, 0),
    "long_tied_back": (-20, 0),
    "topknot_bun": (-20, -5),
    "bald_or_shaved": (-20, -10),
    "scruffy_short": (-20, -15),
}

RUNTIME_BASE_WIDTH = 115
HUMAN_FIGURE_HEIGHT_TO_BASE_WIDTH = 1.4


def alpha_bounds(image):
    box = image.getchannel("A").getbbox()
    if not box:
        raise RuntimeError("asset has no visible pixels")
    return {"left": box[0], "top": box[1], "right": box[2], "bottom": box[3],
            "width": box[2] - box[0], "height": box[3] - box[1]}


def checker(size, step=32):
    image = Image.new("RGBA", size, "#22272a")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            if (x // step + y // step) % 2:
                draw.rectangle((x, y, x + step - 1, y + step - 1), fill="#30373a")
    return image


def fit(image, max_size):
    copy = image.copy()
    copy.thumbnail(max_size, Image.Resampling.LANCZOS)
    return copy


def render_body_sheet(bodies):
    cell = (430, 470)
    sheet = Image.new("RGBA", (cell[0] * 3, cell[1]), "#171b1d")
    draw = ImageDraw.Draw(sheet)
    for index, (posture, body) in enumerate(bodies.items()):
        preview = fit(body, (390, 410))
        x = index * cell[0] + (cell[0] - preview.width) // 2
        y = 34 + (410 - preview.height)
        sheet.alpha_composite(preview, (x, y))
        draw.text((index * cell[0] + 16, 12), posture, fill="#e7e1d2")
    out = BODY_ROOT / "review/human_feminine_neutral_bodies_contact_sheet.png"
    sheet.convert("RGB").save(out, quality=95)


def render_base_fit_sheet(bodies):
    base = Image.open(ASSET_ROOT.parent / "base_combinations/betrayers_coin.png").convert("RGBA")
    base = base.resize((115, round(base.height * 115 / base.width)), Image.Resampling.LANCZOS)
    cell = (360, 380)
    sheet = Image.new("RGBA", (cell[0] * 3, cell[1]), "#171b1d")
    draw = ImageDraw.Draw(sheet)
    for index, (posture, body) in enumerate(bodies.items()):
        bounds = body.getchannel("A").getbbox()
        cropped = body.crop(bounds)
        figure_height = round(RUNTIME_BASE_WIDTH * HUMAN_FIGURE_HEIGHT_TO_BASE_WIDTH)
        scale = figure_height / cropped.height
        figure = cropped.resize((round(cropped.width * scale), figure_height), Image.Resampling.LANCZOS)
        center_x = index * cell[0] + cell[0] // 2
        base_x = center_x - base.width // 2
        base_y = 292
        sheet.alpha_composite(base, (base_x, base_y))
        figure_x = center_x - figure.width // 2
        figure_y = base_y + 34 - figure.height
        sheet.alpha_composite(figure, (figure_x, figure_y))
        draw.text((index * cell[0] + 12, 12), f"{posture} / 115 px base / NPC ratio", fill="#e7e1d2")
        draw.line((base_x, base_y + base.height // 2, base_x + base.width, base_y + base.height // 2), fill="#ff615b", width=1)
    sheet.convert("RGB").save(BODY_ROOT / "review/human_feminine_base_fit_115px.png", format="PNG")


def render_hair_sheet(body, posture):
    manifest = json.loads((HAIR_ROOT / "hair_asset_manifest.json").read_text())
    records = [record for record in manifest["assets"] if record["colorId"] == "black"]
    cell = (360, 430)
    sheet = Image.new("RGBA", (cell[0] * 4, cell[1] * 2), "#171b1d")
    draw = ImageDraw.Draw(sheet)
    target_anchor = BODY_HEAD_ANCHORS[posture]
    placements = {}
    for index, record in enumerate(records):
        style = record["styleId"]
        hair = Image.open(ROOT / "app/mini_preview" / record["file"]).convert("RGBA")
        scale = STYLE_SCALES[style]
        hair = hair.resize((round(hair.width * scale), round(hair.height * scale)), Image.Resampling.LANCZOS)
        source_anchor = record["anchors"]["faceOpening"]
        offset = STYLE_OFFSETS[style]
        paste = (
            round(target_anchor[0] + offset[0] - source_anchor["x"] * scale),
            round(target_anchor[1] + offset[1] - source_anchor["y"] * scale),
        )
        composed = Image.new("RGBA", body.size)
        composed.alpha_composite(body)
        composed.alpha_composite(hair, paste)
        preview = fit(composed, (330, 370))
        col, row = index % 4, index // 4
        x = col * cell[0] + (cell[0] - preview.width) // 2
        y = row * cell[1] + 38 + (370 - preview.height)
        sheet.alpha_composite(preview, (x, y))
        draw.text((col * cell[0] + 12, row * cell[1] + 12), style, fill="#e7e1d2")
        placements[style] = {"scale": scale, "offset": {"x": offset[0], "y": offset[1]},
                             "bodyFaceOpeningAnchor": {"x": target_anchor[0], "y": target_anchor[1]},
                             "paste": {"x": paste[0], "y": paste[1]}}
    sheet.convert("RGB").save(BODY_ROOT / f"review/human_feminine_{posture}_hair_fit_black.png", format="PNG")
    return placements


def main():
    bodies = {}
    records = []
    for number in (1, 2, 3):
        posture = f"posture_{number}"
        path = BODY_ROOT / f"cutout/human_feminine_{posture}_body.png"
        image = Image.open(path).convert("RGBA")
        bodies[posture] = image
        records.append({
            "id": f"human_feminine_{posture}_body",
            "status": "generated_pending_review",
            "sourceKind": "image_generated_chroma_cutout",
            "file": str(path.relative_to(ROOT)),
            "sourceFile": str((BODY_ROOT / f"source/human_feminine_{posture}_body_chroma.png").relative_to(ROOT)),
            "canvas": {"width": image.width, "height": image.height},
            "alphaBounds": alpha_bounds(image),
            "anchors": {"head": {"x": BODY_HEAD_ANCHORS[posture][0], "y": BODY_HEAD_ANCHORS[posture][1]}},
        })
    render_body_sheet(bodies)
    render_base_fit_sheet(bodies)
    hair_placements = {
        posture: render_hair_sheet(body, posture)
        for posture, body in bodies.items()
    }
    manifest = {"status": "generated_pending_review", "assets": records,
                "hairFit": hair_placements,
                "runtimeProof": {
                    "baseWidth": RUNTIME_BASE_WIDTH,
                    "humanFigureHeightToBaseWidth": HUMAN_FIGURE_HEIGHT_TO_BASE_WIDTH,
                    "status": "passes_visual_fit"
                }}
    (BODY_ROOT / "metadata/human_feminine_body_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
