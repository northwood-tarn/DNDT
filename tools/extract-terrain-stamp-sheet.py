#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: extract-terrain-stamp-sheet.py <stamp-sheet.png> <out-dir>", file=sys.stderr)
        return 1

    sheet_path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(sheet_path).convert("RGBA")
    width, height = sheet.size

    # The generated atlas is a 3x2 layout with generous gutters. Use proportional
    # crops so minor generator size changes do not break extraction.
    crops = {
        "floor_negative_ink_v1.png": rel_box(width, height, 0.022, 0.052, 0.325, 0.488),
        "high_floor_negative_ink_v1.png": rel_box(width, height, 0.348, 0.052, 0.651, 0.488),
        "slope_negative_ink_v1.png": rel_box(width, height, 0.671, 0.052, 0.974, 0.488),
        "cliff_face_negative_ink_v1.png": rel_box(width, height, 0.022, 0.532, 0.325, 0.953),
        "rim_debris_negative_ink_v1.png": rel_box(width, height, 0.348, 0.532, 0.651, 0.953),
        "void_atmosphere_negative_ink_v1.png": rel_box(width, height, 0.671, 0.532, 0.974, 0.953),
    }
    for name, box in crops.items():
        sheet.crop(box).save(out_dir / name)

    (out_dir / "MANIFEST.md").write_text(
        "\n".join(
            [
                "# AI Terrain Stamp Library 01",
                "",
                f"Extracted from `{sheet_path.name}`.",
                "",
                "These are generated terrain stamps for deterministic grid-locked combat-map composition.",
                "The source sheet is preserved alongside this extracted library.",
            ]
        )
        + "\n"
    )
    print(out_dir)
    return 0


def rel_box(width: int, height: int, left: float, top: float, right: float, bottom: float) -> tuple[int, int, int, int]:
    return (round(width * left), round(height * top), round(width * right), round(height * bottom))


if __name__ == "__main__":
    raise SystemExit(main())
