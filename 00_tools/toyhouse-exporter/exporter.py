"""Create static, Toyhouse-friendly character profile copies.

The original site remains the source of truth.  This tool reads its CSS
variables and writes a separate toyhouse-page.html with inline styles only.
"""

from __future__ import annotations

import html
import re
import tkinter as tk
from dataclasses import dataclass
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[2]
CHARACTER_ROOTS = (ROOT / "03_Characters",)
VARIABLE = re.compile(r"(?m)^\s*(--[\w-]+)\s*:\s*(.*?);\s*$")
URL_VALUE = re.compile(r"^url\((?:['\"])?(.*?)(?:['\"])?\)$")


@dataclass(frozen=True)
class Character:
    label: str
    folder: Path


def read_variables(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    return {name: value.strip() for name, value in VARIABLE.findall(text)}


def css_text(value: str, fallback: str = "") -> str:
    value = value.strip()
    if len(value) > 1 and value[0] in "\"'" and value[-1] == value[0]:
        value = value[1:-1]
    return value or fallback


def collect_characters() -> list[Character]:
    characters: list[Character] = []
    for root in CHARACTER_ROOTS:
        if not root.exists():
            continue
        for page in root.rglob("character-page.html"):
            if "00_code" in page.parts or not (page.parent / "assets" / "data").is_dir():
                continue
            data = read_variables(page.parent / "assets" / "data" / "character-data.css")
            universe = css_text(data.get("--character-universe", ""), "Unassigned")
            characters.append(Character(f"{universe} / {page.parent.name}", page.parent))
    return sorted(characters, key=lambda item: item.label.casefold())


def profile_data(character: Character) -> dict[str, str]:
    data_dir = character.folder / "assets" / "data"
    merged: dict[str, str] = {}
    for filename in ("character-colors.css", "character-data.css", "character-links.css"):
        merged.update(read_variables(data_dir / filename))
    return merged


def linked_asset(value: str, folder: Path, site_base: str) -> str:
    """Turn a CSS url(...) from assets/data into an HTTPS GitHub Pages URL."""
    match = URL_VALUE.match(value.strip())
    if not match:
        return ""
    relative_to_data = match.group(1)
    target = (folder / "assets" / "data" / relative_to_data).resolve()
    try:
        repository_path = target.relative_to(ROOT).as_posix()
    except ValueError:
        return ""
    if not site_base.strip():
        return repository_path
    return site_base.rstrip("/") + "/" + quote(repository_path, safe="/-_.~")


def page_url(character: Character, site_base: str) -> str:
    relative = (character.folder / "character-page.html").relative_to(ROOT).as_posix()
    return (site_base.rstrip("/") + "/" if site_base.strip() else "") + quote(relative, safe="/-_.~")


def value(values: dict[str, str], key: str, fallback: str = "—") -> str:
    return html.escape(css_text(values.get(key, ""), fallback), quote=True)


def image(values: dict[str, str], key: str, folder: Path, site_base: str) -> str:
    return html.escape(linked_asset(values.get(key, ""), folder, site_base), quote=True)


def render(character: Character, site_base: str) -> str:
    values = profile_data(character)
    colors = {
        "main": css_text(values.get("--background-main", ""), "#181b22"),
        "primary": css_text(values.get("--background-primary", ""), "#242a35"),
        "secondary": css_text(values.get("--background-secondary", ""), "#3a4352"),
        "accent": css_text(values.get("--color-accent", ""), "#d9a441"),
        "text": css_text(values.get("--text-color-primary", ""), "#edf0f4"),
        "muted": css_text(values.get("--text-color-secondary", ""), "#c2c9d4"),
    }
    hero = image(values, "--hero-profile", character.folder, site_base)
    banner = image(values, "--hero-title-pattern", character.folder, site_base)
    portrait = image(values, "--infobox-image", character.folder, site_base)
    full_page = html.escape(page_url(character, site_base), quote=True)

    def img(key: str, alt: str, height: int = 130) -> str:
        source = image(values, key, character.folder, site_base)
        if not source:
            return ""
        return (f'<img src="{source}" alt="{html.escape(alt)}" '
                f'style="display:block;width:100%;height:{height}px;object-fit:cover;">')

    gallery = "".join(
        f'<div style="flex:1 1 150px;min-width:0;padding:3px;">{img(f"--gallery-{number}", "Gallery image", 120)}</div>'
        for number in range(1, 7)
    )
    appearance = "".join(
        f'<div style="flex:1 1 95px;min-width:0;padding:3px;">{img(f"--appearance-{number}", "Appearance image", 100)}</div>'
        for number in range(1, 4)
    )

    # Everything is inline because Toyhouse profiles cannot depend on the site CSS or JS.
    return f'''<!-- Generated by 00_tools/toyhouse-exporter. Do not edit generated data here;
update character-data.css / character-colors.css / character-links.css, then export again. -->
<div style="box-sizing:border-box;max-width:900px;margin:24px auto;padding:14px;background:{html.escape(colors['main'])};color:{html.escape(colors['text'])};font-family:Georgia,serif;line-height:1.5;">
  <a href="{full_page}" target="_blank" rel="noopener noreferrer" style="display:block;position:relative;height:330px;overflow:hidden;color:inherit;text-decoration:none;background:{html.escape(colors['primary'])};">
    <img src="{hero}" alt="{value(values, '--character-name')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;">
    <img src="{banner}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35;z-index:0;">
    <div style="position:absolute;right:0;bottom:0;left:0;z-index:2;padding:46px 20px 16px;background:linear-gradient(transparent,{html.escape(colors['main'])});">
      <div style="font-family:Arial,sans-serif;font-size:38px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;">{value(values, '--character-name')}</div>
    </div>
  </a>

  <div style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:16px;margin-top:16px;">
    <div style="flex:2 1 390px;min-width:0;">
      <div style="padding:8px 14px;border-top:3px dashed {html.escape(colors['accent'])};border-bottom:3px dashed {html.escape(colors['accent'])};background:{html.escape(colors['secondary'])};font-family:Arial,sans-serif;font-size:20px;font-weight:bold;letter-spacing:2px;text-align:center;text-transform:uppercase;">Description</div>
      <div style="padding:14px 4px;color:{html.escape(colors['muted'])};"><p>{value(values, '--description', '')}</p><p>{value(values, '--description-2', '')}</p></div>
      <div style="padding:8px 14px;border-top:3px dashed {html.escape(colors['accent'])};border-bottom:3px dashed {html.escape(colors['accent'])};background:{html.escape(colors['secondary'])};font-family:Arial,sans-serif;font-size:20px;font-weight:bold;letter-spacing:2px;text-align:center;text-transform:uppercase;">Appearance</div>
      <div style="display:flex;flex-wrap:wrap;margin-top:8px;">{img('--appearance-main', 'Full appearance', 250)}{appearance}</div>
      <div style="padding:8px 14px;margin-top:10px;border-top:3px dashed {html.escape(colors['accent'])};border-bottom:3px dashed {html.escape(colors['accent'])};background:{html.escape(colors['secondary'])};font-family:Arial,sans-serif;font-size:20px;font-weight:bold;letter-spacing:2px;text-align:center;text-transform:uppercase;">Gallery</div>
      <div style="display:flex;flex-wrap:wrap;margin-top:6px;">{gallery}</div>
    </div>

    <div style="flex:1 1 210px;min-width:0;padding:12px;background:{html.escape(colors['primary'])};">
      <img src="{portrait}" alt="" style="display:block;width:100%;height:250px;object-fit:cover;">
      <blockquote style="margin:12px 0;padding:10px;border-left:3px solid {html.escape(colors['accent'])};background:{html.escape(colors['secondary'])};font-size:13px;"><span style="display:block;">{value(values, '--quote')}</span><cite style="display:block;margin-top:7px;text-align:right;color:{html.escape(colors['accent'])};">{value(values, '--quote-author')}</cite></blockquote>
      <div style="padding:10px 0;border-top:1px solid {html.escape(colors['accent'])};font-size:13px;"><b>Title</b><br>{value(values, '--info-title')}</div>
      <div style="padding:10px 0;border-top:1px solid {html.escape(colors['accent'])};font-size:13px;"><b>Role</b><br>{value(values, '--info-role')}</div>
      <div style="padding:10px 0;border-top:1px solid {html.escape(colors['accent'])};font-size:13px;"><b>Origin</b><br>{value(values, '--info-origin')}</div>
    </div>
  </div>

  <a href="{full_page}" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:14px;padding:10px;border:1px solid {html.escape(colors['accent'])};color:{html.escape(colors['text'])};font-family:monospace;font-size:12px;letter-spacing:1px;text-align:center;text-decoration:none;text-transform:uppercase;">Open the full profile &#8599;</a>
</div>
'''


class Exporter(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Toyhouse character exporter")
        self.minsize(670, 470)
        self.characters = collect_characters()
        self.site_base = tk.StringVar()
        self.status = tk.StringVar(value="Choose a character, set the GitHub Pages base URL, then export.")
        self._build()

    def _build(self) -> None:
        outer = ttk.Frame(self, padding=14)
        outer.pack(fill="both", expand=True)
        ttk.Label(outer, text="GitHub Pages base URL (optional for local preview):").pack(anchor="w")
        ttk.Entry(outer, textvariable=self.site_base).pack(fill="x", pady=(3, 12))
        ttk.Label(outer, text="Example: https://username.github.io/repository").pack(anchor="w", pady=(0, 8))

        self.listbox = tk.Listbox(outer, selectmode="extended", exportselection=False, height=16)
        self.listbox.pack(fill="both", expand=True)
        for character in self.characters:
            self.listbox.insert("end", character.label)

        actions = ttk.Frame(outer)
        actions.pack(fill="x", pady=(12, 0))
        ttk.Button(actions, text="Select all", command=lambda: self.listbox.select_set(0, "end")).pack(side="left")
        ttk.Button(actions, text="Export selected", command=self.export).pack(side="right")
        ttk.Label(outer, textvariable=self.status, wraplength=620).pack(anchor="w", pady=(12, 0))

    def export(self) -> None:
        selected = self.listbox.curselection()
        if not selected:
            messagebox.showinfo("Toyhouse exporter", "Select at least one character.")
            return
        written = 0
        for index in selected:
            character = self.characters[index]
            output = character.folder / "toyhouse-page.html"
            output.write_text(render(character, self.site_base.get()), encoding="utf-8")
            written += 1
        self.status.set(f"Exported {written} Toyhouse page(s). Replace or host assets if you used no GitHub Pages URL.")


if __name__ == "__main__":
    Exporter().mainloop()
