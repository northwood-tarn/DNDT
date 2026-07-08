from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "app/mini_preview/assets/pc_builder_production/body_head/geometry_guides"
CANVAS = (512, 512)


POSTURES = {
    "posture_1": {
        "label": "Balanced Ready",
        "anchors": {
            "head": [286, 132],
            "neck": [282, 172],
            "chest": [272, 218],
            "waist": [262, 292],
            "hip_left": [232, 310],
            "hip_right": [292, 304],
            "knee_back": [214, 356],
            "knee_front": [312, 358],
            "foot_back": [202, 394],
            "foot_front": [326, 404],
            "shoulder_back": [238, 214],
            "shoulder_front": [306, 216],
            "elbow_back": [224, 268],
            "elbow_front": [342, 264],
            "hand_back": [222, 318],
            "hand_front": [362, 312],
        },
        "weapon_guides": {
            "primary_hand": [362, 312],
            "offhand": [222, 318],
            "weapon_center": [344, 322],
        },
    },
    "posture_2": {
        "label": "Forward Intent",
        "anchors": {
            "head": [292, 128],
            "neck": [282, 168],
            "chest": [268, 218],
            "waist": [252, 296],
            "hip_left": [220, 314],
            "hip_right": [282, 304],
            "knee_back": [210, 354],
            "knee_front": [316, 360],
            "foot_back": [190, 394],
            "foot_front": [342, 406],
            "shoulder_back": [234, 212],
            "shoulder_front": [302, 218],
            "elbow_back": [222, 270],
            "elbow_front": [346, 270],
            "hand_back": [218, 326],
            "hand_front": [384, 318],
        },
        "weapon_guides": {
            "primary_hand": [384, 318],
            "offhand": [218, 326],
            "weapon_center": [360, 324],
        },
    },
    "posture_3": {
        "label": "Guarded / Staff-Compatible",
        "anchors": {
            "head": [278, 132],
            "neck": [274, 172],
            "chest": [264, 220],
            "waist": [254, 296],
            "hip_left": [226, 314],
            "hip_right": [282, 306],
            "knee_back": [216, 358],
            "knee_front": [292, 360],
            "foot_back": [202, 396],
            "foot_front": [316, 404],
            "shoulder_back": [232, 216],
            "shoulder_front": [300, 218],
            "elbow_back": [222, 270],
            "elbow_front": [334, 286],
            "hand_back": [226, 306],
            "hand_front": [356, 344],
        },
        "weapon_guides": {
            "primary_hand": [356, 344],
            "offhand": [226, 306],
            "staff_top": [356, 148],
            "staff_hand": [356, 344],
            "staff_bottom": [356, 410],
            "weapon_center": [356, 344],
        },
    },
}


BONES = [
    ("head", "neck"),
    ("neck", "chest"),
    ("chest", "waist"),
    ("waist", "hip_left"),
    ("waist", "hip_right"),
    ("hip_left", "knee_back"),
    ("knee_back", "foot_back"),
    ("hip_right", "knee_front"),
    ("knee_front", "foot_front"),
    ("chest", "shoulder_back"),
    ("chest", "shoulder_front"),
    ("shoulder_back", "elbow_back"),
    ("elbow_back", "hand_back"),
    ("shoulder_front", "elbow_front"),
    ("elbow_front", "hand_front"),
]

DOT_SIZES = {
    "head": 33,
    "hand_back": 13,
    "hand_front": 13,
    "foot_back": 17,
    "foot_front": 17,
}


def font(size: int) -> ImageFont.ImageFont:
    for candidate in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def draw_dashed_line(draw: ImageDraw.ImageDraw, start, end, fill, width=3, dash=12, gap=8):
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    length = (dx * dx + dy * dy) ** 0.5
    if length == 0:
        return
    step = dash + gap
    count = int(length // step) + 1
    for i in range(count):
        a = i * step / length
        b = min((i * step + dash) / length, 1)
        draw.line(
            [(x1 + dx * a, y1 + dy * a), (x1 + dx * b, y1 + dy * b)],
            fill=fill,
            width=width,
        )


def draw_posture(posture_id: str, spec: dict, transparent: bool) -> Image.Image:
    bg = (0, 0, 0, 0) if transparent else (246, 244, 237, 255)
    image = Image.new("RGBA", CANVAS, bg)
    draw = ImageDraw.Draw(image)
    anchors = spec["anchors"]

    if not transparent:
        draw.polygon([(256, 352), (384, 416), (256, 480), (128, 416)], outline=(190, 178, 150, 255), fill=None, width=2)
        draw.line([(128, 416), (384, 416)], fill=(218, 209, 185, 255), width=1)
        draw.line([(256, 352), (256, 480)], fill=(218, 209, 185, 255), width=1)

    if "staff_top" in spec["weapon_guides"]:
        draw_dashed_line(
            draw,
            spec["weapon_guides"]["staff_top"],
            spec["weapon_guides"]["staff_bottom"],
            fill=(85, 94, 110, 220),
            width=4,
        )

    for a, b in BONES:
        draw.line([tuple(anchors[a]), tuple(anchors[b])], fill=(18, 21, 26, 255), width=5)

    waist = anchors["waist"]
    draw.ellipse(
        [waist[0] - 43, waist[1] - 19, waist[0] + 43, waist[1] + 19],
        outline=(18, 21, 26, 255),
        width=5,
    )

    for name, point in anchors.items():
        radius = DOT_SIZES.get(name, 7)
        fill = (246, 244, 237, 255) if name == "head" else (245, 247, 250, 255)
        outline = (18, 21, 26, 255)
        draw.ellipse(
            [point[0] - radius, point[1] - radius, point[0] + radius, point[1] + radius],
            fill=fill,
            outline=outline,
            width=4 if radius >= 13 else 2,
        )

    for name, point in spec["weapon_guides"].items():
        if name in {"staff_top", "staff_bottom"}:
            radius = 8
            draw.ellipse(
                [point[0] - radius, point[1] - radius, point[0] + radius, point[1] + radius],
                fill=(255, 255, 255, 245),
                outline=(85, 94, 110, 255),
                width=3,
            )
        elif name not in anchors:
            radius = 5
            draw.ellipse(
                [point[0] - radius, point[1] - radius, point[0] + radius, point[1] + radius],
                fill=(70, 98, 150, 255),
            )

    if not transparent:
        title = f"{posture_id}: {spec['label']}"
        draw.text((28, 26), title, fill=(18, 21, 26, 255), font=font(24))
        draw.text((28, 462), "right-facing geometry guide; no art/base baked in", fill=(76, 78, 82, 255), font=font(16))

    return image


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "status": "reference_geometry_guide",
        "notProductionArt": True,
        "canvas": {"width": CANVAS[0], "height": CANVAS[1]},
        "coordinateSpace": "screen pixels, right-facing isometric miniature guide",
        "notes": [
            "Circles mark head, hands, and feet.",
            "Waist is an oval.",
            "Posture 3 includes a dashed staff guide with bottom planted near the front foot.",
            "These guides are intended for alignment and later raster art generation; they are not miniature production art.",
        ],
        "postures": {},
    }

    contact = Image.new("RGBA", (CANVAS[0] * 3, CANVAS[1]), (246, 244, 237, 255))
    for index, (posture_id, spec) in enumerate(POSTURES.items()):
        transparent_img = draw_posture(posture_id, spec, transparent=True)
        review_img = draw_posture(posture_id, spec, transparent=False)
        transparent_img.save(OUT_DIR / f"{posture_id}_wire_skeleton.png")
        review_img.save(OUT_DIR / f"{posture_id}_wire_skeleton_review.png")
        contact.alpha_composite(review_img, (index * CANVAS[0], 0))
        manifest["postures"][posture_id] = {
            "label": spec["label"],
            "anchors": spec["anchors"],
            "weaponGuides": spec["weapon_guides"],
            "bones": BONES,
            "files": {
                "transparentPng": f"{posture_id}_wire_skeleton.png",
                "reviewPng": f"{posture_id}_wire_skeleton_review.png",
            },
        }

    contact.save(OUT_DIR / "pc_posture_wire_skeletons_contact_sheet.png")
    manifest["contactSheet"] = "pc_posture_wire_skeletons_contact_sheet.png"
    (OUT_DIR / "pc_posture_wire_skeletons.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(OUT_DIR)


if __name__ == "__main__":
    main()
