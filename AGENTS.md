# Prestige UI — AGENTS.md

## Architecture

- **Zero-dependency** JS desktop shell. Use `dist/prestige.umd.cjs` (classic `<script>`) or `dist/prestige.js` (ESM) + `dist/prestige.css` directly. TypeScript is strictly a compile-time tool — output is standalone vanilla JS.
- TypeScript sources in `typescript/src/`, CSS modules in `css/*.css`.
- `Prestige` class in `typescript/src/core/DesktopEngine.ts`; other modules extend it or export standalone classes.
- Global helpers: `$tag`, `$text`, `$id`, `createBtn`, `createCard`, etc. (exposed as `window.*` globals by the UMD finalizer).

## Build

```bash
npm run build        # TypeScript build then CSS build
cd typescript && npm run build   # TS only: vite + finalize-umd + tsc declarations
python3 scripts/build.py         # CSS only: concatenates css/*.css + manifest.json
```

Vite (ESM config in `typescript/vite.config.ts`) bundles `typescript/src/index.ts` into `dist/prestige.js` (ES) and `dist/prestige.umd.cjs` (UMD); `typescript/scripts/finalize-umd.mjs` post-processes the UMD so the `Prestige` global is the class and the vanilla `window.*` helpers are restored. `python3 scripts/build.py` concatenates `css/*.css` into `dist/prestige.css` and generates content-hashed SRI assets + `manifest.json`.

## Verification

```bash
cd typescript && npm run typecheck   # strict tsc
cd typescript && npm run test        # vitest 85/85
cd typescript && npm run smoke       # UMD bundle smoke test
python3 scripts/verify.py            # release checks (needs chrome)
```

## Module order (must be maintained)

**TS:** `utils/dom.ts` → `utils/sanitize.ts` → `utils/lucide-icons-data.ts` → `ui/LucideIcons.ts` → `ui/ComponentRegistry.ts` → `core/Memory.ts` → `ui/Components.ts` → `ui/Dialogs.ts` → `core/Store.ts` → `core/WindowManager.ts` → `core/DesktopEngine.ts` → `index.ts`

**CSS:** `tokens.css` → `base.css` → `desktop.css` → `menubar.css` → `dock.css` → `windows.css` → `context-menu.css` → `components.css` → `dialogs.css`

## Code conventions

- CSS vars prefixed `--prestige-` (see `css/tokens.css`).
- Internal methods prefixed `_`.
- Window state classes: `.is-minimized`, `.is-zoomed`, `.is-focused`, `.is-dragging`, `.is-closing`, `.is-gone`, `.is-restoring`.
- Dialog methods return `Promise`; accept string or object.
- SVG icons in `ICONS` object (`typescript/src/ui/lucide-icons-data.ts`).
- DOM via `$tag()` — never `innerHTML` for dynamic content.
- Drag/resize: raw mouse/touch events, no HTML5 DnD.
- Animations: CSS transitions on `transform`/`opacity`.

## Usage

```html
<link rel="stylesheet" href="dist/prestige.css">
<script src="dist/prestige.umd.cjs" defer></script>
<body class="desktop-body">
```

## Config-driven features (constructor options)

All features are gated behind boolean flags in the `Prestige` constructor.
Set any option to `false` to disable at runtime — no code changes needed.

```js
new Prestige({
  gpuAcceleration: true,    // GPU rendering hints (will-change, translateZ, backface-visibility)
  animations: true,         // All CSS animations and transitions
  particleExplosion: true,  // Particle effect on double-click close-all
  dock: true,               // Bottom dock bar
  topdock: true,            // Top menubar circular icons
  clock: true,              // Menubar HH:MM clock
  search: true,             // Spotlight search (Ctrl+Space)
  windowSwitcher: true,     // Ctrl+` window switcher with thumbnails
  dockDragDrop: true,       // Dock/topdock drag-and-drop reorder
  expose: true,             // Hot-corner Exposé / Mission Control
  xray: true,               // Alt+X X-Ray glass peek mode
  snap: true,               // Window magnet snap (top=full, left/right=50%)
  shakeToMinimize: true,    // Shake window to minimize all others
  flickToMinimize: true,    // Flick window down to minimize
  grid: false,              // Desktop grid background
})
```

GPU can be disabled per-session via `data-gpu="false"` on `<html>`:
```html
<html data-gpu="false">
```

## Theming (no hardcoded colors)

Every color value is a CSS custom property in `css/tokens.css` — 75+ variables
covering accent (gold), glass (white overlay), shadow (black overlay), and
semantic (success/warning/danger) variants. Change any value in `tokens.css`
and it propagates everywhere. Zero hardcoded colors exist outside `tokens.css`.

Key variables:
```css
--prestige-accent           /* brand accent (default: #fbe482) */
--prestige-accent-XX        /* accent at XX% opacity */
--prestige-glass-XX         /* white overlay at XX% opacity */
--prestige-shadow-XX        /* black overlay at XX% opacity */
--prestige-text             /* primary text (default: #000000) */
--prestige-bg               /* background (default: #ffffff) */
--prestige-success          /* green */
--prestige-warning          /* orange */
--prestige-danger           /* red */
```

## Key facts

- `dist/` is the source of truth; `typescript/src/` and `css/*.css` are the sources. Backport any new feature to `typescript/src/` before running the build.
- Tests: `typescript/tests/` — vitest 85/85; strict `npm run typecheck`.
- `PRESTIGE.md` is the authoritative spec — don't invent names/behaviors not in it.
- `examples/index.html` at root is a full demo; `examples/` has minimal and dialogs-demo variants.

## Change logging

- Every change must be logged in `CHANGES.md` with a `YYYY-MM-DD HH:MM` timestamp and a brief description.
- Each AI-coder change, from a single variable change to a full refactor, must be recorded with BOTH a **change title** and a **summary**.
- For **simple changes** (single variable, one-line fix): record one bullet with the title and a 1-line summary.
- For **multi/sweeping changes** (multiple files, feature work, refactors): record multiple bullets per distinct change, each with its own title and summary, under a single timestamped entry. Each bullet must state exactly what was changed (file(s), symbol(s), behavior) so the full scope of the AI coder's edits is traceable.
- Format template:

```md
## YYYY-MM-DD HH:MM

- **Change title** — brief summary of what was changed and files/functions affected.
```

- The bullet list is mandatory for every session; if nothing is changed, a `No changes` entry must still be recorded.

## Engineering quality

- All code must be production grade: secure by default, high performance, maintainable, resilient, and thoroughly validated before delivery.

## Development principles

- **Modularity & standalone architecture**: Each module is self-contained with clear responsibilities. No tight coupling between components; extensions add to `Prestige.prototype` without modifying core internals.
- **Config-driven & customizable**: Features and behaviors should be driven by configuration options (passed to the `Prestige` constructor or set via public APIs), making it easy to adapt the shell for different projects without forking or patching source.

## Dialogs — NO native browser dialogs

All user-facing messages MUST use Prestige's built-in `showFlashModal(type, message)` instead of native `alert()`, `confirm()`, or `prompt()`. The function is defined globally in `desktop.html:66` (modal overlay, supports `"success"` and `"error"` types). Native browser dialogs are **STRICTLY BANNED** in Admin UI pages — they block the event loop, break HTMX workflows, and look out of place in the Prestige shell. For confirmations use `showConfirmDialog(message, onConfirm)` defined in `desktop.html:79`. Both are always available because `desktop.html` is the shell that loads every admin page.

## Prestige UI development rules

- ALWAYS use Prestige UI built-in custom dialogs (`showFlashModal`, `showConfirmDialog`) for any popup dialog — native browser dialogs are **STRICTLY BANNED**.
- ALWAYS respect Prestige UI modular design in new UI development. Extend the `PluginManager`/`registerApp` pattern rather than adding monolithic JS. New pages should load via the capability manifest, not hardcoded routes.
- ALWAYS use doc strings for UI pages (both Python route handlers and Jinja2 templates). Every route function must have a docstring describing its purpose, template, and context variables. Every template should have an HTML comment at the top describing its role.

## Prestige UI placement config (dock / top bar / hidden)

Each app registered via `registerApp(appId, manifest)` supports a `manifest.placement` field:

- `"dock"` (default) — bottom dock button
- `"topdock"` — small circular icon in the top menubar
- `"hidden"` — not shown (accessible via search Ctrl+Space)
- `"both"` — appears in both locations
