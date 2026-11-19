"""Local visual editor for the character archive.

Run through start.bat, then open http://127.0.0.1:8765.
The server deliberately binds only to this computer and only permits writes
inside 03_Characters/<character>/assets.
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parents[2]
CHARACTERS = ROOT / "03_Characters"
HOST = "127.0.0.1"
PORT = 8765
VARIABLE = re.compile(r"(?m)^\s*(--[\w-]+)\s*:\s*(.*?);\s*$")
URL = re.compile(r"^url\((?:['\"])?(.*?)(?:['\"])?\)$")
IMAGE_SUFFIXES = {".png", ".gif", ".webp", ".jpg", ".jpeg"}
sys.path.insert(0, str(ROOT / "00_tools" / "asset-updater" / "_vendor"))


def character_dir(name: str) -> Path:
    candidate = (CHARACTERS / name).resolve()
    if not candidate.is_dir() or candidate.parent != CHARACTERS.resolve():
        raise ValueError("Unknown character")
    return candidate


def variables(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    return {name: value.strip() for name, value in VARIABLE.findall(path.read_text(encoding="utf-8-sig"))}


def css_value(value: str) -> str:
    value = value.strip()
    if len(value) > 1 and value[0] in "\"'" and value[-1] == value[0]:
        return value[1:-1]
    return value


def image_path(folder: Path, links: dict[str, str], variable: str) -> Path | None:
    match = URL.match(links.get(variable, "").strip())
    if not match:
        return None
    value = unquote(match.group(1))
    if value.startswith(("http:", "https:", "data:")):
        return None
    path = (folder / "assets" / "data" / value).resolve()
    assets = (folder / "assets").resolve()
    if not path.is_relative_to(assets) or path.suffix.lower() not in IMAGE_SUFFIXES:
        return None
    return path


def image_variables(folder: Path) -> dict[str, Path]:
    links = variables(folder / "assets" / "data" / "character-links.css")
    return {name: path for name in links if (path := image_path(folder, links, name))}


def update_colors(path: Path, updates: dict[str, str]) -> None:
    original = path.read_text(encoding="utf-8-sig")
    for name, color in updates.items():
        if not re.fullmatch(r"--[\w-]+", name) or not re.fullmatch(r"#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?", color):
            raise ValueError("Invalid colour value")
        pattern = re.compile(rf"(?m)^(\s*{re.escape(name)}\s*:\s*)[^;]+;")
        original, changed = pattern.subn(rf"\g<1>{color};", original, count=1)
        if not changed:
            raise ValueError(f"Colour variable not found: {name}")
    path.write_text(original, encoding="utf-8")


def update_image_link(folder: Path, variable: str, target: Path) -> None:
    path = folder / "assets" / "data" / "character-links.css"
    original = path.read_text(encoding="utf-8-sig")
    relative = Path(os.path.relpath(target, path.parent)).as_posix()
    pattern = re.compile(rf"(?m)^(\s*{re.escape(variable)}\s*:\s*)url\([^;]*\);")
    updated, changed = pattern.subn(rf"\g<1>url('{relative}');", original, count=1)
    if not changed:
        raise ValueError(f"Image variable not found: {variable}")
    path.write_text(updated, encoding="utf-8")


def jpeg_to_png(data: bytes) -> bytes:
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise ValueError("Pillow is required to convert JPG/JPEG images") from exc
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        image = ImageOps.exif_transpose(image).convert("RGB")
        output = io.BytesIO()
        image.save(output, format="PNG")
        return output.getvalue()


def update_fonts(path: Path, updates: dict[str, str]) -> None:
    allowed = {"--font-accent", "--font-primary", "--font-secondary", "--head-font-size"}
    original = path.read_text(encoding="utf-8-sig")
    for name, value in updates.items():
        if name not in allowed or any(character in value for character in "\r\n;"):
            raise ValueError("Invalid font value")
        if name == "--head-font-size" and not re.fullmatch(r"\d{1,3}px", value):
            raise ValueError("Heading size must use whole pixels, for example 96px")
        pattern = re.compile(rf"(?m)^(\s*{re.escape(name)}\s*:\s*)[^;]+;")
        original, changed = pattern.subn(rf"\g<1>{value};", original, count=1)
        if not changed:
            raise ValueError(f"Font variable not found: {name}")
    path.write_text(original, encoding="utf-8")


def update_data(path: Path, updates: dict[str, str]) -> None:
    allowed = {
        "--page-title", "--character-name", "--theme-symbol", "--description",
        "--description-2", "--quote", "--quote-author", "--personality", "--trivia",
        "--info-role", "--info-origin", "--track-1-name", "--track-1-artist",
        "--track-2-name", "--track-2-artist",
    }
    original = path.read_text(encoding="utf-8-sig")
    for name, value in updates.items():
        value = value.replace("\r", " ").replace("\n", " ").strip()
        if name not in allowed or ";" in value:
            raise ValueError("Invalid text value")
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        pattern = re.compile(rf"(?m)^(\s*{re.escape(name)}\s*:\s*)[^;]+;")
        original, changed = pattern.subn(lambda match: f'{match.group(1)}"{escaped}";', original, count=1)
        if not changed:
            raise ValueError(f"Data variable not found: {name}")
    path.write_text(original, encoding="utf-8")


class EditorHandler(BaseHTTPRequestHandler):
    def log_message(self, *_args: object) -> None:
        pass

    def respond(self, status: int, body: bytes, content_type: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def json(self, status: int, payload: object) -> None:
        self.respond(status, json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def body(self) -> dict[str, object]:
        size = int(self.headers.get("Content-Length", "0"))
        if size > 30 * 1024 * 1024:
            raise ValueError("File is too large (limit: 30 MB)")
        return json.loads(self.rfile.read(size).decode("utf-8"))

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        try:
            if parsed.path.startswith("/site/"):
                relative = Path(unquote(parsed.path.removeprefix("/site/")))
                target = (ROOT / relative).resolve()
                if not target.is_file() or not target.is_relative_to(ROOT.resolve()):
                    raise ValueError("Site file not found")
                mime = {
                    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
                    ".js": "text/javascript; charset=utf-8", ".png": "image/png",
                    ".gif": "image/gif", ".webp": "image/webp", ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".mp3": "audio/mpeg",
                }.get(target.suffix.lower(), "application/octet-stream")
                return self.respond(HTTPStatus.OK, target.read_bytes(), mime)

            if parsed.path == "/api/characters":
                result = []
                for folder in sorted(path for path in CHARACTERS.iterdir() if path.is_dir() and path.name != "00_code"):
                    data = variables(folder / "assets" / "data" / "character-data.css")
                    result.append({"name": folder.name, "universe": css_value(data.get("--character-universe", '"Unassigned"'))})
                return self.json(HTTPStatus.OK, result)

            if parsed.path == "/api/character":
                name = parse_qs(parsed.query).get("name", [""])[0]
                folder = character_dir(name)
                data = variables(folder / "assets" / "data" / "character-data.css")
                colors = variables(folder / "assets" / "data" / "character-colors.css")
                fonts = variables(folder / "assets" / "data" / "character-font.css")
                images = [{"variable": variable, "path": str(path.relative_to(folder)).replace("\\", "/"), "url": f"/asset?name={name}&path={path.relative_to(folder).as_posix()}"} for variable, path in image_variables(folder).items()]
                return self.json(HTTPStatus.OK, {"name": name, "data": {key: css_value(value) for key, value in data.items()}, "colors": colors, "fonts": fonts, "images": images})

            if parsed.path == "/asset":
                query = parse_qs(parsed.query)
                folder = character_dir(query.get("name", [""])[0])
                relative = Path(query.get("path", [""])[0])
                target = (folder / relative).resolve()
                if not target.is_file() or not target.is_relative_to((folder / "assets").resolve()):
                    raise ValueError("Asset not found")
                mime = {".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(target.suffix.lower(), "application/octet-stream")
                return self.respond(HTTPStatus.OK, target.read_bytes(), mime)

            if parsed.path in {"/", "/index.html"}:
                return self.respond(HTTPStatus.OK, (Path(__file__).parent / "index.html").read_bytes(), "text/html; charset=utf-8")
            return self.respond(HTTPStatus.NOT_FOUND, b"Not found", "text/plain")
        except (ValueError, OSError) as error:
            self.json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def do_POST(self) -> None:  # noqa: N802
        try:
            payload = self.body()
            name = str(payload.get("name", ""))
            folder = character_dir(name)

            if self.path == "/api/colors":
                updates = payload.get("colors")
                if not isinstance(updates, dict):
                    raise ValueError("Colours are missing")
                update_colors(folder / "assets" / "data" / "character-colors.css", {str(key): str(value) for key, value in updates.items()})
                return self.json(HTTPStatus.OK, {"ok": True})

            if self.path == "/api/fonts":
                updates = payload.get("fonts")
                if not isinstance(updates, dict):
                    raise ValueError("Fonts are missing")
                update_fonts(folder / "assets" / "data" / "character-font.css", {str(key): str(value) for key, value in updates.items()})
                return self.json(HTTPStatus.OK, {"ok": True})

            if self.path == "/api/data":
                updates = payload.get("data")
                if not isinstance(updates, dict):
                    raise ValueError("Character data is missing")
                update_data(folder / "assets" / "data" / "character-data.css", {str(key): str(value) for key, value in updates.items()})
                return self.json(HTTPStatus.OK, {"ok": True})

            if self.path == "/api/open-assets":
                assets = (folder / "assets").resolve()
                if not assets.is_dir() or not assets.is_relative_to(folder.resolve()):
                    raise ValueError("Assets folder not found")
                if not hasattr(os, "startfile"):
                    raise ValueError("Opening Explorer is available only on Windows")
                os.startfile(str(assets))  # type: ignore[attr-defined]
                return self.json(HTTPStatus.OK, {"ok": True})

            if self.path == "/api/image":
                variable = str(payload.get("variable", ""))
                filename = str(payload.get("filename", ""))
                encoded = str(payload.get("data", ""))
                target = image_variables(folder).get(variable)
                if not target:
                    raise ValueError("Unknown image target")
                suffix = Path(filename).suffix.lower()
                if suffix not in {".png", ".gif", ".jpg", ".jpeg"}:
                    raise ValueError("Choose a PNG, GIF, JPG or JPEG file")
                raw = base64.b64decode(encoded, validate=True)
                if not raw:
                    raise ValueError("Empty file")
                if suffix in {".jpg", ".jpeg"}:
                    raw = jpeg_to_png(raw)
                    suffix = ".png"
                if suffix != target.suffix.lower():
                    target = target.with_suffix(suffix)
                    update_image_link(folder, variable, target)
                target.write_bytes(raw)
                return self.json(HTTPStatus.OK, {"ok": True, "path": str(target.relative_to(folder)).replace("\\", "/")})

            return self.json(HTTPStatus.NOT_FOUND, {"error": "Unknown action"})
        except (ValueError, OSError, json.JSONDecodeError) as error:
            self.json(HTTPStatus.BAD_REQUEST, {"error": str(error)})


if __name__ == "__main__":
    print(f"Character Editor: http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), EditorHandler).serve_forever()
