#!/usr/bin/env python3
"""Render the current companion miniature roster as a labelled contact sheet."""

import base64
import html
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs" / "companion_mini_contact_sheet.png"
SVG_OUTPUT = ROOT / "outputs" / "companion_mini_contact_sheet.svg"

MINIS = [
    ("TARA", "LOCKED", "app/mini_preview/assets/tara_human_rapier_v4.png"),
    ("XAVIER", "LOCKED", "app/mini_preview/assets/xavier_v7.png"),
    ("DUNCAN", "LATEST · SIZE-MATCHED", "app/mini_preview/assets/duncan_v1_chroma_cutout.png"),
    ("DANICA", "LOCKED", "app/mini_preview/assets/danica_v4_locked.png"),
    ("TAHRONE", "LOCKED · MASKED", "app/mini_preview/assets/tahrone_masked_base.png"),
    ("KESTREL", "LOCKED", "app/mini_preview/assets/kestrel_locked.png"),
]


def data_uri(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def main() -> None:
    width, height = 1960, 1870
    card_w, card_h, gutter, margin, header_h = 600, 790, 28, 52, 132
    cards = []
    for index, (name, status, relative_path) in enumerate(MINIS):
        col, row = index % 3, index // 3
        x, y = margin + col * (card_w + gutter), header_h + row * (card_h + gutter)
        status_color = "#c69b62" if "LATEST" in status else "#7fbd9a"
        cards.append(f"""
          <g>
            <rect x="{x}" y="{y}" width="{card_w}" height="{card_h}" rx="18" fill="#202328" stroke="#363b42" stroke-width="2"/>
            <image href="{data_uri(ROOT / relative_path)}" x="{x + 18}" y="{y + 16}" width="564" height="678" preserveAspectRatio="xMidYMid meet"/>
            <rect x="{x + 1}" y="{y + 698}" width="598" height="91" fill="#191b1f"/>
            <text x="{x + 24}" y="{y + 754}" class="name">{html.escape(name)}</text>
            <text x="{x + 576}" y="{y + 752}" text-anchor="end" class="status" fill="{status_color}">{html.escape(status)}</text>
          </g>""")

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
      <style>
        text {{ font-family: Helvetica, Arial, sans-serif; }}
        .title {{ font-size: 42px; font-weight: 700; fill: #f1ece0; letter-spacing: 1px; }}
        .subtitle {{ font-size: 17px; font-weight: 700; fill: #9ca3aa; letter-spacing: 3px; }}
        .name {{ font-size: 30px; font-weight: 700; fill: #f4efe4; letter-spacing: 1px; }}
        .status {{ font-size: 16px; font-weight: 700; letter-spacing: 1px; }}
      </style>
      <rect width="100%" height="100%" fill="#15171a"/>
      <text x="52" y="67" class="title">THE PLAYER'S PARTY</text>
      <text x="52" y="108" class="subtitle">COMPANION MINIATURES</text>
      {''.join(cards)}
    </svg>"""
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    SVG_OUTPUT.write_text(svg, encoding="utf-8")
    chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    subprocess.run([
        chrome, "--headless", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", f"--window-size={width},{height}",
        f"--screenshot={OUTPUT}", SVG_OUTPUT.as_uri()
    ], check=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
