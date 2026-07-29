#!/usr/bin/env python3
"""Refresh selected cells in the locked edge-to-edge 20x20 icon mass sheet."""

from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
SHEET_PNG = ROOT / "output/pdf/icon_catalogue_mass_sheet.png"
SHEET_PDF = ROOT / "output/pdf/icon_catalogue_mass_sheet.pdf"
TILE = 40

REPLACEMENTS = {
    "mark_of_authority": (
        ROOT / "app/combat_ui_v2/icons/abilities/drafts/warlock_tessera_v3/mark_of_authority.png",
        ROOT / "app/combat_ui_v2/icons/abilities/mark_of_authority.png",
    ),
    "cataclysmic_debt": (
        ROOT / "app/combat_ui_v2/icons/abilities/drafts/warlock_tessera_v3/cataclysmic_debt.png",
        ROOT / "app/combat_ui_v2/icons/abilities/cataclysmic_debt.png",
    ),
    "infernal_legacy_1": (
        ROOT / "app/combat_ui_v2/icons/abilities/drafts/species_template/full_set/tiefling_infernal__infernal_legacy.png",
        ROOT / "app/combat_ui_v2/icons/abilities/infernal_legacy_1.png",
    ),
    "guiding_bolt": (
        ROOT / "app/combat_ui_v2/icons/spells/drafts/cleric_remaining/guiding_bolt.png",
        ROOT / "app/combat_ui_v2/icons/spells/guiding_bolt.png",
    ),
    "poison_spray": (
        ROOT / "app/combat_ui_v2/icons/spells/drafts/poison/masters/poison_spray.png",
        ROOT / "app/combat_ui_v2/icons/spells/poison_spray.png",
    ),
    "acid_splash": (
        ROOT / "app/combat_ui_v2/icons/spells/drafts/acid/masters/acid_splash.png",
        ROOT / "app/combat_ui_v2/icons/spells/acid_splash.png",
    ),
    "fire_bolt": (
        ROOT / "app/combat_ui_v2/icons/spells/drafts/fire/masters/fire_bolt.png",
        ROOT / "app/combat_ui_v2/icons/spells/fire_bolt.png",
    ),
    "ray_of_frost": (
        ROOT / "app/combat_ui_v2/icons/spells/drafts/ice/masters/ray_of_frost.png",
        ROOT / "app/combat_ui_v2/icons/spells/ray_of_frost.png",
    ),
    "disintegrate": (
        ROOT / "app/combat_ui_v2/icons/spells/drafts/wizard_remaining/disintegrate_v1_80.png",
        ROOT / "app/combat_ui_v2/icons/spells/disintegrate.png",
    ),
    "finger_of_death": (
        ROOT / "app/combat_ui_v2/icons/spells/drafts/wizard_remaining/finger_of_death_v1_80.png",
        ROOT / "app/combat_ui_v2/icons/spells/finger_of_death.png",
    ),
}


def tile_image(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB").resize((TILE, TILE), Image.Resampling.LANCZOS)


def difference(a: Image.Image, b: Image.Image) -> float:
    stat = ImageStat.Stat(ImageChops.difference(a, b))
    return sum(value * value for value in stat.rms)


def main() -> None:
    sheet = Image.open(SHEET_PNG).convert("RGB")
    assert sheet.size == (800, 800)
    cells = [
        sheet.crop((x, y, x + TILE, y + TILE))
        for y in range(0, sheet.height, TILE)
        for x in range(0, sheet.width, TILE)
    ]
    claimed = set()
    resolved = {}
    for name, (old_path, new_path) in REPLACEMENTS.items():
        old = tile_image(old_path)
        ranked = sorted((difference(old, cell), index) for index, cell in enumerate(cells) if index not in claimed)
        score, index = ranked[0]
        claimed.add(index)
        resolved[name] = (index, score)
        x = (index % 20) * TILE
        y = (index // 20) * TILE
        sheet.paste(tile_image(new_path), (x, y))

    sheet.save(SHEET_PNG, optimize=True)
    pdf = canvas.Canvas(str(SHEET_PDF), pagesize=(800, 800))
    pdf.drawImage(str(SHEET_PNG), 0, 0, width=800, height=800, mask="auto")
    pdf.showPage()
    pdf.save()
    for name, (index, score) in resolved.items():
        print(f"{name}: cell={index} row={index // 20} col={index % 20} score={score:.2f}")


if __name__ == "__main__":
    main()
