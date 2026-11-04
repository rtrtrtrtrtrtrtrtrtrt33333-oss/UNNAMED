# Site Tools

Small local tools for managing the HTML archive without turning the content itself into React.

Run from this folder:

```bat
inventory.bat
build.bat
sync-character-pages.bat
check-links.bat
serve.bat
```

## Commands

- `inventory.bat` counts HTML/CSS/JS/media files by world and writes `reports/inventory.json`.
- `build.bat` copies the static site into `HTML/_dist`.
- `sync-character-pages.bat` copies each world character template into every character folder as `character-page.html`.
- `check-links.bat` checks local `href`, `src`, and CSS `url(...)` references in `_dist` when it exists, otherwise in the source tree.
- `serve.bat` starts a local mini server. It serves the source tree by default. Use `serve.bat --dist` to serve `_dist` after running `build.bat`.

The tools use portable Node from:

```text
C:\Users\main\dev\tools\node-v24.21.0-win-x64
```