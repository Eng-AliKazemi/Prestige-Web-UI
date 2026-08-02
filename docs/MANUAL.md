# Prestige UI — Manual

## Overview

Prestige UI is a zero-runtime-dependency, modular desktop shell written in TypeScript and CSS, compiled to standalone vanilla JavaScript. It provides a complete desktop-environment UI (menubar, dock, draggable/resizable windows, window manager, dialog system) inside a web browser. A Vite/TypeScript build produces the release bundles and a Python script creates the integrity manifests.

**Goal:** Deliver a production-grade, themeable desktop UI that can be embedded in any web project — static site, admin dashboard, SaaS app, or backend-driven application — with zero setup overhead.

### Applications

| Use Case | How to Use |
|----------|------------|
| **Standalone demo / portfolio** | Open `examples/index.html` directly in a browser |
| **Admin dashboard frontend** | Load `dist/prestige.umd.cjs` (classic `<script>`) or `dist/prestige.js` (ESM) + `dist/prestige.css` in your backend template (Django, Flask, Rails, Laravel, etc.) |
| **SPA / client-side app** | Import the dist files and initialize via `new Prestige(config)` |
| **HTMX / Turbo / LiveView** | The shell is compatible; pass DOM nodes or sanitized, explicitly trusted server-rendered content |
| **Desktop-like web app** | Full window management, drag, resize, snap, search, keyboard shortcuts |

---

## Architecture

Prestige UI is authored in TypeScript (strict mode, zero runtime dependencies) and compiled to standalone vanilla JavaScript. The sources live in the `typescript/` workspace:

```
typescript/src/
├── index.ts                # Library entry point & barrel exports
├── types/
│   ├── desktop.ts          # App manifest, window state, isolation tier types
│   ├── store.ts            # Store, SWR, schema types
│   ├── aiml.ts             # AI/ML model config, SSE stream types
│   ├── web3.ts             # Web3 address & transaction types
│   └── index.ts            # Barrel type exports
├── utils/
│   ├── dom.ts              # Safe structural DOM builders ($tag, $text)
│   └── sanitize.ts         # HTML sanitizers, escaping, app-id guard
├── core/
│   ├── Memory.ts           # DisposalStack, Owned (affine single-ownership)
│   ├── Store.ts            # Reactive store, persistence, SWR cache
│   ├── WindowManager.ts    # Window lifecycle, snap, cascade, resize
│   └── DesktopEngine.ts    # Prestige class, init(), config, overlays
└── ui/
    ├── LucideIcons.ts      # Typed SVG icon registry & renderer
    ├── lucide-icons-data.ts # Curated offline icon data (62 icons)
    ├── ComponentRegistry.ts # Extensible component factory registry
    ├── Components.ts       # 33 built-in component primitives
    └── Dialogs.ts          # Promise-based dialogs, web3 guard, toasts
```

**TS module order (must be maintained):** `utils/dom.ts` → `utils/sanitize.ts` → `utils/lucide-icons-data.ts` → `ui/LucideIcons.ts` → `ui/ComponentRegistry.ts` → `core/Memory.ts` → `ui/Components.ts` → `ui/Dialogs.ts` → `core/Store.ts` → `core/WindowManager.ts` → `core/DesktopEngine.ts` → `index.ts`

**CSS module order:** `tokens.css` → `base.css` → `desktop.css` → `menubar.css` → `dock.css` → `windows.css` → `context-menu.css` → `components.css` → `dialogs.css`

The `Prestige` class in `core/DesktopEngine.ts` is the entry point. The UMD finalizer restores the vanilla `window.*` helper globals (`$tag`, `$text`, `createBtn`, `renderIcons`, etc.), making the compiled bundle a true drop-in for the classic `<script>` distribution. The shell HTML (menubar, dock, desktop canvas) is declared declaratively in your HTML — Prestige reads the existing DOM and binds behavior.

### AI-assisted development

For AI coding assistants (Claude, GPT, Gemini, Copilot, Cursor, opencode) the
repository root ships **[`AI_INSTRUCTIONS.md`](../AI_INSTRUCTIONS.md)**, the
authoritative meta-prompt for building on and contributing to Prestige. It
encodes the project's non-negotiables (no dynamic `innerHTML`, no native
browser dialogs, config-gated features, no hardcoded colors), the module and
CSS build orders, the `dist/`-as-truth build pipeline, frontend and backend
build patterns (including the reference `examples/fastapi-demo/`), the security
model (app-ID validation, URL sanitization, credential guard, isolation tier,
Web3 guard, no-fake-crypto rule), and the mandatory build/typecheck/test +
`CHANGES.md` logging loop. Start any AI-assisted session by instructing the
assistant to read `AGENTS.md` and `AI_INSTRUCTIONS.md` before editing.

---

## Quick Start

### 1. Include the files

Use the drop-in UMD bundle for a classic `<script>` tag (no build step required):

```html
<link rel="stylesheet" href="dist/prestige.css">
<script src="dist/prestige.umd.js" defer></script>
```

The ESM build `dist/prestige.js` is available for `import`-based setups (Vite, Webpack, Node), and ships `dist/index.d.ts` for full editor autocompletion in both JS and TS projects.

### 2. Mark up the shell

```html
<body class="desktop-body">
  <div class="desktop-wallpaper"></div>

  <header class="menubar">
    <div class="menubar-left">
      <button class="menubar-btn" id="search-btn" title="Search (Ctrl+Space)">
        <i data-prestige-icon="search"></i>
      </button>
      <span class="menubar-app">My App</span>
      <span class="menubar-item" id="active-window-title">No windows open</span>
    </div>
    <div class="menubar-center" id="topdock">
      <!-- Topdock items (optional) -->
    </div>
    <div class="menubar-right">
      <span class="menubar-clock" id="menubar-clock"></span>
    </div>
  </header>

  <main class="desktop-canvas" id="desktop-canvas">
    <div class="desktop-watermark">
      <div class="atrium-wordmark">Prestige Web UI</div>
    </div>
  </main>

  <div class="dock-wrap" id="dock-wrap">
    <nav class="dock" id="dock">
      <div class="dock-group" id="dock-group-main">
        <!-- Dock buttons -->
        <button class="dock-item" data-section="dashboard" data-icon="layout-dashboard"
                data-label="Dashboard" data-color="#fbe482">
          <span class="dock-icon"><i data-prestige-icon="layout-dashboard"></i></span>
          <span class="dock-label">Dashboard</span>
          <span class="dock-dot"></span>
        </button>
      </div>
    </nav>
  </div>
</body>
```

### 3. Initialize

```html
<script>
  document.addEventListener('DOMContentLoaded', function () {
    var os = new Prestige({ /* config */ });
    os.init();
    renderIcons();
  });
</script>
```

---

## Configuration

All features are gated via constructor options. Set any to `false` to disable.

```js
new Prestige({
  // Display
  gpuAcceleration: true,    // GPU rendering hints on windows, dock, menubar
  animations: true,         // CSS transitions and animations
  particleExplosion: true,  // Particle burst on double-click close-all
  grid: false,              // Desktop grid background

  // Shell
  dock: true,               // Bottom dock bar
  topdock: true,            // Top menubar circular icons
  clock: true,              // Menubar HH:MM clock (updates every 30s)
  dockDragDrop: true,       // Dock/topdock drag-and-drop reorder

  // Window management
  snap: true,               // Window magnet snap (top=full, left/right=50%)
  shakeToMinimize: true,    // Shake a window to minimize all others
  flickToMinimize: true,    // Flick a window downward to minimize it
  windowSwitcher: true,     // Ctrl+Backtick window switcher with thumbnails

  // Desktop features
  search: true,             // Spotlight search (Ctrl+Space)
  expose: true,             // Hot-corner Exposé / Mission Control
  xray: true,               // Alt+X X-Ray glass peek mode
  session: true,            // Persist window state across reloads
  lockScreen: false,        // Ctrl+Shift+L lock screen overlay
  tiling: false,            // Ctrl+Alt+T grid tile all windows
  minimizedPreview: true,   // Hover dock icon shows window thumbnail
  toastCenter: true,        // Notification bell and history panel

})
```

`container` may scope an instance to an existing shell root. The root must contain `#desktop-canvas` and any enabled menubar/dock markup; `init()` binds the declarative shell and does not generate it. App IDs must begin with a letter and contain only letters, numbers, `_`, or `-` (maximum 64 characters). Calling `destroy()` aborts Prestige-managed listeners and removes only instance-created overlays; host markup is preserved.

### Per-session overrides via HTML attributes

```html
<html data-animations="false">   <!-- disable all animations -->
<html data-gpu="false">          <!-- disable GPU acceleration -->
```

---

## Theming & Customization

All colors are CSS custom properties in `css/tokens.css`. Change any value and it propagates everywhere — no hardcoded colors in any other file.

### Key variables

```css
/* Brand accent */
--prestige-accent: #fbe482;           /* base color */
--prestige-accent-08                  /* at 8% opacity */
--prestige-accent-10                  /* at 10% opacity */
--prestige-accent-85                  /* at 85% opacity */

/* Glass overlays (white) */
--prestige-glass-06                   /* barely visible */
--prestige-glass-50                   /* semi-transparent */
--prestige-glass-90                   /* nearly solid */

/* Shadow overlays (black) */
--prestige-shadow-00                  /* fully transparent */
--prestige-shadow-30                  /* subtle shadow */
--prestige-shadow-85                  /* strong shadow */

/* Semantic */
--prestige-text: #000000;
--prestige-bg: #ffffff;
--prestige-success: #10b981;          /* green */
--prestige-warning: #f59e0b;          /* orange */
--prestige-danger: #ef4444;           /* red */
--prestige-close: #e81123;            /* close-button red */

/* Layout */
--prestige-radius: 12px;
--prestige-radius-lg: 18px;
--prestige-radius-sm: 8px;
--prestige-menubar-height: 40px;
--prestige-font: 'Inter', -apple-system, ...;
--prestige-font-mono: 'JetBrains Mono', ...;
```

### Complete list of all 119 variables

The full set in `css/tokens.css` covers every opacity variant used (119 `--prestige-*` custom properties):
- Accent: `--prestige-accent-04` through `--prestige-accent-90` (opacity steps)
- Glass: `--prestige-glass-06` through `--prestige-glass-90` (opacity steps)
- Shadow: `--prestige-shadow-00` through `--prestige-shadow-90` (opacity steps)
- Semantic: success, warning, danger with soft/border variants
- Legacy aliases: `--prestige-border`, `--prestige-glass-bg`, etc.

### Customizing per deployment

**Option A — Override in your own CSS (no build needed):**
```css
:root {
  --prestige-accent: #ff6b6b;
  --prestige-accent-08: rgba(255, 107, 107, 0.08);
  /* ... repeat for each opacity variant you use ... */
}
```

**Option B — Edit `css/tokens.css` and rebuild:**
```bash
npm run build
```

**Option C — Set variables at runtime in JS:**
```js
document.documentElement.style.setProperty('--prestige-accent', '#ff6b6b');
```

---

## Dock Items

Dock buttons are declared in HTML with data attributes:

```html
<button class="dock-item"
        data-section="app-name"      <!-- unique ID -->
        data-icon="settings"         <!-- Lucide icon name -->
        data-label="App Name"        <!-- display label -->
        data-color="#fbe482">        <!-- gradient color -->
  <span class="dock-icon"><i data-prestige-icon="settings"></i></span>
  <span class="dock-label">App Name</span>
  <span class="dock-dot"></span>
</button>
```

### Placement options

Use `registerApp()` to add items programmatically:

```js
os.registerApp('analytics', {
  label: 'Analytics',
  icon: 'chart-no-axes-column',
  c1: '#fbe482',
  c2: '#000000',
  placement: 'dock',       // 'dock' | 'topdock' | 'hidden' | 'both'
  w: 900,                  // optional window width hint (px)
  h: 620,                  // optional window height hint (px)
  content: contentNodeOrRenderer, // DOM Node or renderer; strings render as text
  trustedHtml: false,              // true only for already-sanitized trusted markup
});
```

Right-clicking a dock or topdock icon opens a placement context menu (Dock / Top Dock / Hidden, plus Reset to default). Programmatically: `os.setAppPlacement(appId, 'topdock')` persists a runtime override (see below).

---

## Window Management API

| Method | Description |
|--------|-------------|
| `openWindow(appId, icon?, label?, dockButton?)` | Open or toggle a window |
| `closeWindow(win)` | Close with disposal + optional animation |
| `minimizeWindow(win)` | Scale-to-dock minimize |
| `restoreWindow(win)` | FLIP-animate restore |
| `toggleMaximize(win)` | Fullscreen toggle |
| `focusWindow(win)` | Raise z-index, update title |
| `setWindowTitle(win, title)` | Update window title text |
| `setWindowContent(win, content)` | Replace window content |
| `getWindowContent(win)` | Get content element |
| `closeAllWindows()` | Close all with particle effect or instant |
| `explodeAndCloseAll()` | Force particle-burst close of all windows |
| `setAppPlacement(appId, placement)` | Persist a dock/topdock/hidden/both placement override |
| `resetAppPlacement(appId)` | Clear a persisted placement override (falls back to manifest/default) |
| `showContextMenu(opts)` | Open a generic context menu at x/y |
| `hideContextMenu()` | Close the open context menu |
| `getState()` | Serialize open window state |
| `setState(states)` | Restore window states |
| `ownResource(win, resource, disposer)` | Wrap in Owned + bind to window disposal |
| `ownSocket(win, url, protocols?)` | Open an owned WebSocket |
| `lock()` | Lock screen overlay |
| `unlock(password)` | Unlock with password check |
| `notify(type, title, message)` | Push a toast notification |
### Window size map

Per-section default sizes are defined in `WindowManager.ts` (`typescript/src/core/WindowManager.ts`):
```js
overview: [780, 540], wizard: [780, 580], analytics: [900, 620],
infra: [760, 540], keys: [720, 520], models: [740, 540],
widget: [720, 540], prompts: [760, 560], routing: [740, 540],
guard: [720, 560], memory: [760, 540], breakers: [720, 500],
vector: [740, 540], rag: [800, 580], upload: [740, 520],
gdpr: [740, 540], observe: [760, 540], groups: [720, 540],
users: [740, 560], register: [680, 500], logs: [760, 540],
audit: [740, 520], feedback: [760, 540], limits: [700, 500],
config: [800, 560], about: [640, 480], calendar: [760, 560],
notes: [720, 540], system: [820, 600], /* ... 29 sections */
```
Default fallback: `[760, 540]`. A per-app override can be supplied via the app manifest's `w`/`h` size hints (`AppManifest.w`, `AppManifest.h`).

---

## Memory Management

Prestige uses a deterministic, GC-free resource management system built on two primitives in `typescript/src/core/Memory.ts` that enforce **affine (single-ownership) semantics**.

### `DisposalStack`

A structured cleanup registry. Every window gets its own stack at creation time (`win._disposal = new DisposalStack(section)`).

```js
// Auto-clean event listener when the window closes
win._disposal.listen(button, 'click', handler);

// Auto-clear timer
win._disposal.setTimeout(function () { /* ... */ }, 1000);

// Auto-close WebSocket
win._disposal.manageSocket(ws);

// Register store subscription teardown
win._disposal.subscribe(store.$subscribe(callback));

// Zero-fill a secret buffer when the window closes
win._disposal.ownSecret(secretBytes);
```

Call `win._disposal.dispose()` (done automatically by `closeWindow()`) to run all cleanups in LIFO order.

### `Owned`

An affine wrapper — allows at most one consumer. Use it to transfer ownership of a resource between windows or components:

```js
var owned = new Owned(socket, function (s) { s.close(); });
owned.use(function (s) { s.send('hello'); });   // borrow
var transferred = owned.move();                   // transfer — owned becomes dead
// owned.use(...) would now throw "use-after-move detected"
```

### Composition chain

```
Window  →  win._disposal  →  Owned resources
```

The convenience methods `ownResource(win, resource, disposer)` and `ownSocket(win, url)` wrap a resource in `Owned` and register it with the window's stack. When `closeWindow()` fires, everything tears down deterministically:

- **Event listeners** are removed (no orphaned handlers)
- **Timers** are cleared (no stale callbacks)
- **WebSockets** are closed (no dangling connections)
- **Owned resources** that were never `.move()`-d trigger a console leak warning

This prevents resource leaks without relying on garbage collection — critical for long-lived SPA sessions.

---

## Component System

`typescript/src/ui/ComponentRegistry.ts` + `typescript/src/ui/Components.ts` extend the shell through a registry instead of modifying core internals. Built-ins return DOM nodes and can be composed into any window or backend-rendered page.

```js
var card = os.createComponent('card', {
  title: 'Account',
  body: createAvatar({ name: 'Sarah Johnson', size: 'lg' }),
  className: 'account-card',
  attributes: { 'aria-label': 'Account card' },
});
```

Every component accepts `id`, `className`, `attributes`, `data`, and object-valued `style`. Use `$tag()`, `$text()`, `createBtn()`, and `createCard()` in custom factories. Factories receive `(options, os)` and must return one DOM `Node`.

```js
Prestige.registerComponent('statusPill', function (options, os) {
  return $tag('span', { class: 'status-pill' }, [$text(options.label || 'Pending')]);
});
var pill = os.createComponent('statusPill', { label: 'Online' });
```

Registry management: `Prestige.listComponents()`, `Prestige.hasComponent(name)`, `Prestige.getComponent(name)`, `Prestige.unregisterComponent(name)`, and `Prestige.registerComponent(name, factory, { replace: true })`.

Built-ins include alerts, accordions, avatars, badges, breadcrumbs, buttons, cards, checkbox/radio/select/textarea/file controls, dropdowns, empty states, input groups, pagination, progress, search, segmented controls, skeletons, steppers, switches, tables, tabs, tooltips, and sortable data tables. Overlay components are available as `os.toast()`, `os.customModal()`, and `os.drawer()`.

## Reactive State Store

Each `Prestige` instance has an isolated `os.store`.

```js
var profile = os.store.createStore('profile', { name: 'Ada' }, { persistKey: 'profile' });
var stop = profile.$subscribe(function (key, value, previous) {});
var release = profile.$bindInput(nameInput, 'name');
```

Cleanup functions returned by subscriptions and bindings should be called when a window closes. `fetchSWR(key, fetcher, { ttl, staleWhileRevalidate, force })` provides deduplicated server caching, while `onCacheChange(key, callback)` receives fresh responses. `os.syncUrlState()` restores registered apps from `?windows=` and returns their IDs.

## Dialog System

All dialogs return a Promise. Accept a string (message) or object `{title, message, confirmText, ...}`.

```js
os.dialogInfo('Saved.')              // → true
os.dialogWarning('Disk space low.')  // → true
os.dialogDanger('Fatal error.')      // → true
os.dialogAlert('Are you sure?')      // → true
os.dialogConfirm('Continue?')        // → boolean
os.dialogPrompt('Enter name:')       // → string | null
os.dialogSave('Filename:')           // → {filename, confirmed}
os.dialogOpen('Select file:')        // → FileList | null
os.dialogShow({ type: 'confirm', title: 'Proceed?', message: 'This is irreversible.' }) // any dialog type
```

`dialogShow()` is the generic engine behind the wrappers above and accepts any `DialogOptions` (`type`, `title`, `message`, `icon`, `confirmText`, `cancelText`, `defaultValue`, `placeholder`, `noOverlay`, `danger`, `width`, `multiple`, `accept`). The Web3 confirmation overlay is available as `web3TransactionGuard(host, txDetails)` — it renders at the security z-plane, rejects on DOM mutation (MutationObserver), and validates the confirm button is visually unobstructed (clickjacking defense). `os.cacheContent(key, value)`, `os.getCachedContent(key)`, and `os.clearContentCache(key?)` provide an in-memory per-instance content cache.

---

## Keyboard Shortcuts

| Shortcut | Feature | Config Flag |
|----------|---------|-------------|
| `Ctrl+Space` | Spotlight search | `search` |
| `Alt+X` | X-Ray peek (dim non-focused windows) | `xray` |
| `Ctrl+\`` (Backtick) | Window switcher (forward) | `windowSwitcher` |
| `Ctrl+Shift+\`` (Backtick) | Window switcher (reverse) | `windowSwitcher` |
| `Ctrl+Shift+L` | Lock screen | `lockScreen` |
| `Ctrl+Alt+T` | Tiling manager (toggle) | `tiling` |
| `Escape` | Dismiss search / X-Ray / switcher / Exposé / lock screen | — |
| `Ctrl+←` / `Ctrl+→` | Snap focused window to left / right half | `snap` |
| `Ctrl+Shift+←` / `Ctrl+Shift+→` | Cycle focus through open windows | — |
| Double-click dock/topdock icon | Force-close window and free memory | — |

---

## Event Hooks

```js
os.on('window:open', function (payload) { /* payload.section, payload.win */ });
os.on('window:close', function (payload) { /* payload.section, payload.win */ });
os.on('window:focus', function (payload) { /* payload.section, payload.win */ });
// Remove a specific handler with os.off(event, handler); os.off(event) removes all.
```

---

## Build

```bash
npm run build        # TypeScript build (Vite + UMD finalize + tsc declarations) then CSS build
```

The TypeScript sources in `typescript/src/` are compiled by Vite into `dist/prestige.js` (ESM) and `dist/prestige.umd.cjs` (UMD, drop-in `<script>` bundle); the UMD finalizer restores the vanilla `window.*` globals. `python3 scripts/build.py` (invoked automatically by `npm run build`) concatenates `css/*.css` into `dist/prestige.css`, writes `dist/manifest.json` with SHA-384 SRI values and content-hashed assets, and synchronizes the FastAPI example.

For development, you can run the steps separately:
```bash
cd typescript && npm run build    # TS only: vite + finalize-umd + declarations
python3 scripts/build.py          # CSS only: concatenate css + manifest.json
```

**Verification** — `cd typescript && npm run typecheck` (strict tsc), `npm run test` (vitest 178/178 across 13 files), `npm run smoke` (UMD bundle smoke test), and `python3 scripts/verify.py` for build, integrity, security, accessibility, stale-asset, and headless-browser checks.

---

## Using as a Backend Frontend

### Django / Flask / Rails / Laravel

1. Run the build (`npm run build`) and serve the content-hashed files listed in `dist/manifest.json` with immutable caching.
2. Include them in your base template.
3. Add the shell HTML (menubar, dock, canvas) to your base template.
4. Initialize `new Prestige(config)` on page load.
5. Load window content via your backend routes. Pass DOM nodes or renderer functions; strings render as text by default. Use `trustedHtml: true` only for markup sanitized by your application.

Keep scripts/styles external or nonce-protected for CSP. Add HTTPS, secure HttpOnly SameSite cookies, framework CSRF protection, authorization, validation, rate limiting, and clickjacking protection. See the backend hardening checklist in [`AI_INSTRUCTIONS.md`](../AI_INSTRUCTIONS.md) (Building BACKEND) and the reference `examples/fastapi-demo/`.

### HTMX integration

Windows automatically show a loading overlay (`.htmx-loading` class) when HTMX requests are in-flight. Window content can be swapped via HTMX with no additional setup.

### Example: Flask

```html
<!-- templates/base.html -->
<link rel="stylesheet" href="{{ url_for('static', filename='prestige.css') }}">
<script src="{{ url_for('static', filename='prestige.umd.js') }}" defer></script>

<body class="desktop-body">
  <header class="menubar"><!-- shell markup --></header>
  <main class="desktop-canvas" id="desktop-canvas"><!-- watermark --></main>
  <div class="dock-wrap" id="dock-wrap"><!-- dock buttons --></div>

  <script>
    document.addEventListener('DOMContentLoaded', function () {
      var os = new Prestige({
        apps: {
          users: {
            label: 'Users',
            icon: 'users',
            content: renderUsersNode,
          },
        },
      });
      os.init();
      renderIcons();
    });
  </script>
</body>
```

---

## File Structure

```
prestige-ui/
├── dist/
│   ├── prestige.js          # Built JS bundle (ESM)
│   ├── prestige.umd.cjs     # Built JS bundle (UMD, classic <script> drop-in)
│   ├── prestige.css         # Built CSS bundle
│   ├── index.d.ts           # TypeScript declarations
│   └── manifest.json        # SRI hashes and content-hashed asset map
├── typescript/
│   ├── package.json         # TS workspace (zero runtime dependencies)
│   ├── tsconfig.json        # Strict compiler options
│   ├── vite.config.ts       # Vite library build (ESM + UMD)
│   ├── scripts/
│   │   ├── finalize-umd.mjs # Restores Prestige class global + window.* helpers
│   │   └── smoke-umd.mjs    # UMD bundle smoke test
│   ├── src/
│   │   ├── index.ts         # Library entry point
│   │   ├── types/           # desktop, store, aiml, web3 contracts
│   │   ├── utils/           # dom.ts, sanitize.ts
│   │   ├── core/            # Memory, Store, WindowManager, DesktopEngine
│   │   └── ui/              # LucideIcons, ComponentRegistry, Components, Dialogs
│   └── tests/
│       ├── helpers/         # DOM test helpers (memoryStorage, mockLayout)
│       ├── unit/            # Vitest unit tests
│       └── integration/     # Desktop lifecycle & memory tests
├── css/
│   ├── tokens.css           # All CSS custom properties (THEME)
│   ├── base.css             # Reset, body, scrollbars
│   ├── desktop.css          # Wallpaper, grid, watermark, canvas
│   ├── menubar.css          # Top bar, topdock items, dropdown
│   ├── dock.css             # Bottom dock, items, labels, drag
│   ├── windows.css          # Windows, titlebar, controls, resize
│   ├── context-menu.css     # Context menu
│   ├── components.css       # Buttons, cards, search, switcher, expose
│   └── dialogs.css          # Dialog overlay and cards
├── examples/
│   ├── index.html             # Full desktop demo — all components and visual effects
│   ├── dialogs-demo.html      # Dialog variants, custom modal, drawer
│   ├── favicon.svg            # Example site favicon (square Prestige mark)
│   └── fastapi-demo/          # FastAPI + reactive state integration
│       └── requirements.txt    # FastAPI example dependencies
├── scripts/
│   ├── build.py             # CSS bundle, SRI hash, and asset synchronization
│   └── verify.py            # Release/security/browser checks
├── tests/
│   └── browser-smoke.html   # Headless Chromium regression fixture
├── AGENTS.md                # Development conventions (read first)
├── AI_INSTRUCTIONS.md       # Meta-prompt for AI coding assistants
├── CHANGES.md               # Changelog
├── MANUAL.md                # User manual (this companion doc lives in docs/)
└── PRESTIGE.md              # Authoritative specification (in docs/)
```
