# Toyhouse exporter

Run `start.bat`, select one or more characters, and enter the base GitHub Pages
URL for this repository. The tool writes `toyhouse-page.html` beside each
selected `character-page.html`.

The result uses only inline CSS and static HTML. It deliberately has no
JavaScript, iframe, local stylesheet, or `data-text` attributes, because
Toyhouse cannot resolve them. Re-export after changing any character data.
