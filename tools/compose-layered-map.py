#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image


KEY = (0, 255, 0)


def main() -> int:
    if len(sys.argv) != 5:
        print("Usage: compose-layered-map.py <composition.json> <base.png> <asset-map.json> <out.png>", file=sys.stderr)
        return 1

    composition_path = Path(sys.argv[1])
    base_path = Path(sys.argv[2])
    asset_map_path = Path(sys.argv[3])
    out_path = Path(sys.argv[4])

    composition = json.loads(composition_path.read_text())
    asset_map = json.loads(asset_map_path.read_text())
    base = Image.open(base_path).convert("RGBA").resize((1920, 1080), Image.Resampling.LANCZOS)

    for layer in sorted(composition["layers"], key=lambda item: item.get("zIndex", 0)):
        if layer["kind"] != "placed_asset":
            continue
        source = normalize_asset_source(asset_map.get(layer["id"]), layer["id"])
        if not source:
            continue
        asset, crop_origin = cutout(Image.open(source["path"]).convert("RGBA"))
        if asset is None:
            continue
        fitted, scale = fit_asset(asset, layer, source)
        target_anchor = layer["anchorPixel"]
        local_anchor = source["localAnchorPixel"]
        local_anchor_after_crop = {
            "x": (local_anchor["x"] - crop_origin["x"]) * scale,
            "y": (local_anchor["y"] - crop_origin["y"]) * scale,
        }
        x = int(round(target_anchor["x"] - local_anchor_after_crop["x"]))
        y = int(round(target_anchor["y"] - local_anchor_after_crop["y"]))
        base.alpha_composite(fitted, (x, y))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.save(out_path)
    print(out_path)
    return 0


def normalize_asset_source(source, layer_id: str) -> dict | None:
    if not source:
        return None
    if isinstance(source, str):
        raise ValueError(
            f"{layer_id}: asset map entries must include path and localAnchorPixel; "
            "legacy string paths make placement depend on cropped-image bottom-center guesses."
        )
    if "path" not in source:
        raise ValueError(f"{layer_id}: asset map entry is missing path")
    if "localAnchorPixel" not in source:
        raise ValueError(f"{layer_id}: asset map entry is missing localAnchorPixel")
    anchor = source["localAnchorPixel"]
    if not isinstance(anchor.get("x"), (int, float)) or not isinstance(anchor.get("y"), (int, float)):
        raise ValueError(f"{layer_id}: localAnchorPixel must contain numeric x and y")
    return source


def cutout(image: Image.Image) -> tuple[Image.Image | None, dict]:
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if abs(r - KEY[0]) < 45 and abs(g - KEY[1]) < 70 and abs(b - KEY[2]) < 45 and g > r + 70 and g > b + 70:
                pixels[x, y] = (r, g, b, 0)
            elif a > 0:
                # Light despill for generated green edges.
                pixels[x, y] = (r, min(g, int((r + b) / 2) + 32), b, a)
    bbox = image.getbbox()
    if not bbox:
        return None, {"x": 0, "y": 0}
    return image.crop(bbox), {"x": bbox[0], "y": bbox[1]}


def fit_asset(asset: Image.Image, layer: dict, source: dict) -> tuple[Image.Image, float]:
    bounds = layer["pixelBounds"]
    footprint_w = bounds["maxX"] - bounds["minX"]
    footprint_h = bounds["maxY"] - bounds["minY"]
    source_footprint = source.get("localFootprintBounds")
    if source_footprint:
        source_w = source_footprint["maxX"] - source_footprint["minX"]
        source_h = source_footprint["maxY"] - source_footprint["minY"]
        scale = min(footprint_w / source_w, footprint_h / source_h)
    else:
        raise ValueError(
            f"{layer['id']}: asset map entry is missing localFootprintBounds; "
            "the compositor must scale from the asset's authored base footprint, not its visible bounding box."
        )
    fitted = asset.resize((max(1, round(asset.width * scale)), max(1, round(asset.height * scale))), Image.Resampling.LANCZOS)
    return fitted, scale


if __name__ == "__main__":
    raise SystemExit(main())
