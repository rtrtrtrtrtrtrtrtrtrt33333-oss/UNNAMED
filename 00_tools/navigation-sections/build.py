"""Validate the section bundles used by world-page.html.

Each world owns its navigation inside ``02_Worlds/<world>/world-page.html``.
The section markup lives in each world's ``assets/data/sections-data.js``;
this tool does not depend on archived standalone navigation pages.
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORLDS = ROOT / "02_Worlds"


def build() -> None:
    for world in sorted(
        path for path in WORLDS.iterdir() if path.is_dir() and path.name != "00_code"
    ):
        page = world / "world-page.html"
        bundle = world / "assets" / "data" / "sections-data.js"

        if not page.is_file() or not bundle.is_file():
            print(f"{world.name}: skipped (world page or section bundle missing)")
            continue

        raw = bundle.read_text(encoding="utf-8-sig")
        _, separator, payload = raw.partition("=")
        if not separator:
            raise ValueError(f"No section data assignment in {bundle}")

        sections = json.loads(payload.strip().removesuffix(";"))
        print(f"{world.name}: {len(sections)} embedded sections")


if __name__ == "__main__":
    build()
