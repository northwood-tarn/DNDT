#!/usr/bin/env python3
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PROD = ROOT / "app/mini_preview/assets/pc_builder_production"
WORK = PROD / "human_feminine/posture_1"
BODY_PATH = WORK / "cutout/human_feminine_posture_1_neck_socket_body.png"
HEAD_PATH = WORK / "cutout/humanlike_feminine_head_narrow.png"
HAIR_MANIFEST = PROD / "hair/hair_asset_manifest.json"
BASE_PATH = ROOT / "app/mini_preview/assets/base_combinations/betrayers_coin.png"

HEAD_SCALE = 0.20
HEAD_PASTE = (585, 93)
HAIR_FACE_OPENING = (690, 165)
HAIR_SCALES = {
    "short_messy": 0.19, "short_severe": 0.19, "long_loose": 0.15,
    "scruffy_shoulder_length": 0.15, "long_tied_back": 0.17,
    "topknot_bun": 0.19, "bald_or_shaved": 0.17, "scruffy_short": 0.19,
}
HAIR_OFFSETS = {
    "short_messy": (-20, -15), "short_severe": (-20, -15), "long_loose": (-20, 0),
    "scruffy_shoulder_length": (-20, 0), "long_tied_back": (-20, 0),
    "topknot_bun": (-20, -5), "bald_or_shaved": (-20, -10), "scruffy_short": (-20, -15),
}


def crop_alpha(image):
    box = image.getchannel("A").getbbox()
    return image.crop(box), box


def base_assembly():
    body = Image.open(BODY_PATH).convert("RGBA")
    head_source = Image.open(HEAD_PATH).convert("RGBA")
    head, head_box = crop_alpha(head_source)
    head = head.resize((round(head.width * HEAD_SCALE), round(head.height * HEAD_SCALE)), Image.Resampling.LANCZOS)
    assembly = Image.new("RGBA", body.size)
    assembly.alpha_composite(body)
    assembly.alpha_composite(head, HEAD_PASTE)
    return assembly, head_box


def render():
    assembly, head_box = base_assembly()
    manifest = json.loads(HAIR_MANIFEST.read_text())
    hairs = [record for record in manifest["assets"] if record["colorId"] == "black"]
    cell = (360, 430)
    sheet = Image.new("RGBA", (cell[0] * 4, cell[1] * 2), "#171b1d")
    draw = ImageDraw.Draw(sheet)
    placements = {}
    for index, record in enumerate(hairs):
        style = record["styleId"]
        hair = Image.open(ROOT / "app/mini_preview" / record["file"]).convert("RGBA")
        scale = HAIR_SCALES[style]
        hair = hair.resize((round(hair.width * scale), round(hair.height * scale)), Image.Resampling.LANCZOS)
        face = record["anchors"]["faceOpening"]
        offset = HAIR_OFFSETS[style]
        paste = (round(HAIR_FACE_OPENING[0] + offset[0] - face["x"] * scale),
                 round(HAIR_FACE_OPENING[1] + offset[1] - face["y"] * scale))
        composed = assembly.copy()
        composed.alpha_composite(hair, paste)
        cropped, _ = crop_alpha(composed)
        cropped.thumbnail((330, 370), Image.Resampling.LANCZOS)
        col, row = index % 4, index // 4
        x = col * cell[0] + (cell[0] - cropped.width) // 2
        y = row * cell[1] + 38 + (370 - cropped.height)
        sheet.alpha_composite(cropped, (x, y))
        draw.text((col * cell[0] + 12, row * cell[1] + 12), style, fill="#e7e1d2")
        placements[style] = {"scale": scale, "paste": {"x": paste[0], "y": paste[1]}}
    sheet.convert("RGB").save(WORK / "review/posture_1_universal_head_hair_fit_black.png")

    base = Image.open(BASE_PATH).convert("RGBA")
    base = base.resize((115, round(base.height * 115 / base.width)), Image.Resampling.LANCZOS)
    figure, _ = crop_alpha(assembly)
    figure_height = round(115 * 1.4)
    figure = figure.resize((round(figure.width * figure_height / figure.height), figure_height), Image.Resampling.LANCZOS)
    runtime = Image.new("RGBA", (360, 320), "#171b1d")
    base_xy = (180 - base.width // 2, 236)
    runtime.alpha_composite(base, base_xy)
    runtime.alpha_composite(figure, (180 - figure.width // 2, base_xy[1] + 34 - figure.height))
    runtime.convert("RGB").save(WORK / "review/posture_1_universal_head_base_fit.png")

    metadata = {
        "status": "generated_pending_review",
        "scope": "posture_1 humanlike humanoid proof; dragonborn excluded",
        "body": str(BODY_PATH.relative_to(ROOT)), "head": str(HEAD_PATH.relative_to(ROOT)),
        "headSourceAlphaBounds": list(head_box), "headScale": HEAD_SCALE,
        "headPaste": {"x": HEAD_PASTE[0], "y": HEAD_PASTE[1]},
        "hairPixelsModified": False, "hairPlacements": placements,
        "runtime": {"baseWidth": 115, "figureHeightToBaseWidth": 1.4, "contactDepth": 34},
    }
    (WORK / "metadata/posture_1_universal_head_socket_proof.json").write_text(json.dumps(metadata, indent=2) + "\n")


if __name__ == "__main__":
    render()
