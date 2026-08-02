# Lucide offline catalog

This directory contains the pinned Lucide SVG source catalog used by Prestige UI.

- Version: `0.468.0`
- Source: <https://github.com/lucide-icons/lucide/tree/0.468.0/icons>
- License: [`0.468.0/LICENSE`](0.468.0/LICENSE)
- SVG count in this snapshot: 1,544

The complete catalog is kept here for offline reference. Only the icons listed in
`scripts/generate_icon_registry.py` are embedded in `src/lucide-icons.js` and the
production bundle. Regenerate the curated runtime registry after adding an icon:

```bash
python3 scripts/generate_icon_registry.py
python3 scripts/build.py
```
