#!/usr/bin/env python3
"""Build the edge-to-edge player ability and spell icon mass sheet."""

from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
ICON_ROOT = ROOT / "app/combat_ui_v2/icons"
OUTPUT_ROOT = ROOT / "output/pdf"
PNG_OUTPUT = OUTPUT_ROOT / "icon_catalogue_mass_sheet.png"
PDF_OUTPUT = OUTPUT_ROOT / "icon_catalogue_mass_sheet.pdf"
ORDER_OUTPUT = OUTPUT_ROOT / "icon_catalogue_mass_sheet_order.txt"
SOURCE_SIZE = (80, 80)
TILE = 40
COLUMNS = 20


def runtime_icons(folder: str) -> list[Path]:
    icons = []
    for path in sorted((ICON_ROOT / folder).glob("*.png"), key=lambda item: item.stem):
        with Image.open(path) as image:
            if image.size == SOURCE_SIZE:
                icons.append(path)
    return icons


def main() -> None:
    # The order is stable and intentionally simple: all ability/species/lineage
    # runtime icons alphabetically, followed by all spell runtime icons.
    icons = runtime_icons("abilities") + runtime_icons("spells")
    rows, remainder = divmod(len(icons), COLUMNS)
    if remainder:
        rows += 1

    sheet = Image.new("RGB", (COLUMNS * TILE, rows * TILE), "black")
    for index, path in enumerate(icons):
        with Image.open(path) as source:
            tile = source.convert("RGB").resize((TILE, TILE), Image.Resampling.LANCZOS)
        x = (index % COLUMNS) * TILE
        y = (index // COLUMNS) * TILE
        sheet.paste(tile, (x, y))

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    sheet.save(PNG_OUTPUT, optimize=True)
    ORDER_OUTPUT.write_text(
        "\n".join(f"{index + 1:03d} {path.relative_to(ROOT)}" for index, path in enumerate(icons)) + "\n"
    )

    width, height = sheet.size
    pdf = canvas.Canvas(str(PDF_OUTPUT), pagesize=(width, height))
    pdf.drawImage(str(PNG_OUTPUT), 0, 0, width=width, height=height, mask="auto")
    pdf.showPage()
    pdf.save()
    print(f"icons={len(icons)} columns={COLUMNS} rows={rows} size={width}x{height}")


if __name__ == "__main__":
    main()
