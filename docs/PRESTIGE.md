# PRESTIGE.md — Prestige Web UI Blueprint

| Field | Value |
|---|---|
| **Product** | Prestige Web UI |
| **Document Version** | 2.5.0 |
| **Status** | Normative, authoritative source of truth |
| **Release** | 2.5.0 |
| **License** | Apache-2.0 |

---

## Table of Contents

- [1. Architecture \& Principles](#1-architecture--principles)
- [2. File Structure \& Build System](#2-file-structure--build-system)
- [3. Memory Engine (`DisposalStack` \& `Owned`)](#3-memory-engine-disposalstack--owned)
- [4. Security, Sanitization \& Data Safety](#4-security-sanitization--data-safety)
- [5. Complete Configuration Reference](#5-complete-configuration-reference)
- [6. Core JavaScript API Reference](#6-core-javascript-api-reference)
- [7. Comprehensive Event System Index](#7-comprehensive-event-system-index)
- [8. App Placement \& Drag-and-Drop Engine](#8-app-placement--drag-and-drop-engine)
- [9. Window Management \& Physics](#9-window-management--physics)
- [10. Extensible Component System (All 33 Primitives)](#10-extensible-component-system-all-33-primitives)
- [11. Reactive State Store, SWR Cache \& URL Sync](#11-reactive-state-store-swr-cache--url-sync)
- [12. Dialogs, Overlays \& Notification System](#12-dialogs-overlays--notification-system)
- [13. Lucide Icon Registry Subsystem](#13-lucide-icon-registry-subsystem)
- [14. Desktop Gestures \& Interactions](#14-desktop-gestures--interactions)
- [15. CSS Custom Properties \& Theme Tokens](#15-css-custom-properties--theme-tokens)
- [16. Performance Optimization \& GPU Compositing](#16-performance-optimization--gpu-compositing)

---

## 1. Architecture & Principles

Prestige UI is a **zero-runtime-dependency, modular, DOM-first desktop environment for the web**. It converts a browser viewport into a window-managed operating system interface featuring glassmorphism chrome, FLIP animations, reactive signals, and deterministic resource management.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HOST APPLICATION                              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                             PRESTIGE ENGINE                             │
├───────────────────┬─────────────────────┬───────────────────────────────┤
│  WINDOW MANAGER   │   STATE & SWR STORE │      COMPONENT REGISTRY       │
│  (Drag/Resize/Snap│  (Signals/URL Sync/ │   (33 Built-in Primitives/    │
│   FLIP Animations)│   Credential Guard) │    DOM Factory System)        │
├───────────────────┴─────────────────────┴───────────────────────────────┤
│                             MEMORY ENGINE                               │
│            (DisposalStack LIFO Cleanup / Owned Affine Wrapper)          │
├─────────────────────────────────────────────────────────────────────────┤
│                             SECURITY LAYER                              │
│         (HTML Text Default / Tree-Walker Sanitizer / App ID Guard)      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                        CSS DESIGN TOKEN SYSTEM                          │
│               (119 Variables / GPU Compositing / Theme Layers)          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Engineering Principles
1. **Zero Runtime Dependencies**: Written entirely in ES6+ vanilla JavaScript and modern CSS. Requires no build steps, bundlers, or frameworks at runtime.
2. **DOM-First Composition**: All UI components return native DOM `Node` instances rather than HTML strings, preserving event handlers, references, and memory ownership.
3. **Strict Memory Isolation**: Every window maintains its own `DisposalStack` to register LIFO teardown handlers for timers, DOM listeners, WebSockets, and subscriptions upon window closure.
4. **XSS Defense-in-Depth**: Text strings are escaped by default. Untrusted backend HTML is safely rendered as plain text unless explicitly opted-in via `trustedHtml: true`, which routes through a strict HTML `TreeWalker` sanitizer.
5. **GPU Compositing First**: Key properties (`transform`, `opacity`) are isolated on hardware-accelerated compositor layers using `will-change`, `translateZ(0)`, and selective `backdrop-filter`.

---

## 2. File Structure & Build System

### Source Layout

```
prestige-ui/
├── typescript/src/              # TypeScript Source Modules
│   ├── index.ts                 # Library entry point & barrel exports
│   ├── types/                   # Type contracts (desktop, store, aiml, web3)
│   ├── utils/                   # dom.ts (safe DOM builders), sanitize.ts (XSS guard)
│   ├── core/                    # Memory, Store, WindowManager, DesktopEngine
│   └── ui/                      # LucideIcons, lucide-icons-data, ComponentRegistry, Components, Dialogs
├── css/                          # CSS Source Modules
│   ├── tokens.css                # CSS custom properties (colors, typography, radii, shadows)
│   ├── base.css                  # CSS reset, body, scrollbars, responsive rules
│   ├── desktop.css               # Wallpaper, grid drift, canvas, watermark, fly-in keyframes
│   ├── menubar.css               # Top menubar & dropdown styling
│   ├── dock.css                  # Bottom dock, top dock items, bounce keyframes, drag-and-drop feedback
│   ├── windows.css               # Window chrome, 8 resize handles, FLIP animations, snap preview
│   ├── context-menu.css          # Context menu styling
│   ├── components.css           # Component primitives, window switcher, Spotlight, Toast center, Lock screen
│   └── dialogs.css               # Prestige dialog styling
├── dist/                         # Compiled Bundle Output
│   ├── prestige.js               # ESM bundle
│   ├── prestige.umd.cjs          # UMD bundle (classic <script> drop-in)
│   ├── prestige.css              # Concatenated CSS bundle
│   ├── index.d.ts                # TypeScript declarations
│   └── manifest.json             # SRI hashes and content-hashed asset map
└── scripts/
    ├── build.py                  # CSS bundle + SRI/manifest (JS comes from the TS build)
    └── verify.py                 # Automated integrity & security audit
```

At the repository root, alongside this specification, sit the contributor contracts:
`AGENTS.md` (hard coding conventions), `AI_INSTRUCTIONS.md` (the meta-prompt for
AI coding assistants, documenting architecture, build, frontend/backend build
patterns, the security model, and the change-log mandate), `README.md` (usage
overview), and `CHANGES.md` (audited change log for every session). Build tools,
verifiers, and type declarations must agree with these marks before release.

### Build Execution
```bash
npm run build
```
The TypeScript sources in `typescript/src/` are compiled by Vite into `dist/prestige.js` (ESM) and `dist/prestige.umd.cjs` (UMD), with the UMD finalizer (`typescript/scripts/finalize-umd.mjs`) restoring the vanilla `window.*` helper globals for classic `<script>` usage. `tsc` emits `dist/index.d.ts`. `python3 scripts/build.py` then concatenates `css/*.css` into `dist/prestige.css`, computes SHA-384 Subresource Integrity (SRI) hashes, updates `dist/manifest.json`, and outputs non-minified distribution bundles.

Verification: `cd typescript && npm run typecheck` (strict tsc), `npm run test` (vitest 178/178 across 13 test files), `npm run smoke` (UMD bundle), and `python3 scripts/verify.py` (build + integrity + security + headless-browser checks).

---

## 3. Memory Engine (`DisposalStack` & `Owned`)

Located in `typescript/src/core/Memory.ts`, the Memory Engine guarantees deterministic resource teardown without relying on non-deterministic Garbage Collection.

```
Window Close Event
       │
       ▼
win._disposal.dispose()
       │
       ├─► LIFO execution of registered cleanups
       ├─► removeEventListener() for all listen() calls
       ├─► clearTimeout() / clearInterval()
       ├─► socket.close() for managed WebSockets
       ├─► Unsubscribe callbacks for store subscriptions
       └─► Audit Owned resources; warn in console if any leaked
```

### `DisposalStack` Class
An instance of `DisposalStack` is attached to every window (`win._disposal`).

```javascript
const stack = new DisposalStack('WindowName');
```

| Method | Signature | Description |
|---|---|---|
| `defer(fn)` | `(fn: Function) => void` | Push a cleanup callback to be executed on disposal (LIFO order). |
| `listen(target, type, listener, options?)` | `(target: EventTarget, type: string, listener: EventListener, options?: any) => void` | Binds an event listener and defers its removal automatically. |
| `setTimeout(fn, delay)` | `(fn: Function, delay: number) => number` | Creates a timer and defers `clearTimeout()` on disposal. |
| `setInterval(fn, delay)` | `(fn: Function, delay: number) => number` | Creates an interval and defers `clearInterval()` on disposal. |
| `manageSocket(socket)` | `(socket: WebSocket) => void` | Manages a `WebSocket` instance, closing it safely if `readyState < 2` on disposal. |
| `subscribe(unsubscribeFn)` | `(unsubscribeFn: Function) => void` | Registers an unsubscribe callback (e.g., store subscription). |
| `own(owned)` | `(owned: Owned) => Owned` | Registers an `Owned` instance for lifecycle tracking. |
| `ownSecret(buffer)` | `(buffer: Uint8Array \| ArrayBuffer) => Uint8Array \| ArrayBuffer` | Tracks a byte buffer holding secrets; zeroes its contents on disposal. |
| `dispose()` | `() => void` | Executes all queued cleanups in LIFO order; logs warnings if alive `Owned` handles are leaked. |

### `Owned` Class (Affine Single-Ownership)
Encapsulates a resource ensuring it has exactly one owner at any time.

```javascript
const resource = new Owned(value, disposerFn);
```

| Method | Signature | Description |
|---|---|---|
| `use(fn)` | `(fn: (val: T) => R) => R` | Borrows the inner resource. Throws if moved or disposed (`"use-after-move detected"`). |
| `move()` | `() => Owned<T>` | Transfers ownership to a new `Owned` handle, invalidating the current one. Throws on double-move. |
| `dispose()` | `() => void` | Invokes the disposer function and marks the handle as dead. Idempotent. |
| `isAlive()` | `() => boolean` | Returns `true` if the resource has not been moved or disposed. |

### Prestige Instance Memory Helpers

```javascript
// Wrap an arbitrary resource and bind it to a window's disposal stack
const owned = prestige.ownResource(win, myService, (service) => service.stop());

// Open a WebSocket bound to the window lifecycle
const socketHandle = prestige.ownSocket(win, 'wss://api.example.com/stream');
```

---

## 4. Security, Sanitization & Data Safety

### 1. Default Content Escaping
Strings passed as window or component content are treated strictly as plain text data by default:
```javascript
// SAFE: Renders as text, script tag is NOT executed
prestige.openWindow('app', 'icon', 'Title', null);
// Content internally uses $text(String(content)) or escapeHtml()
```

### 2. Explicit `trustedHtml` & TreeWalker Sanitizer
When rendering HTML markup, applications must explicitly set `trustedHtml: true`. Prestige passes the string through `sanitizeHtml()` (`typescript/src/utils/sanitize.ts`):

- **Blocked Elements**: `script`, `style`, `iframe`, `object`, `embed`, `link`, `meta`, `base`, `form`, `textarea`, `input`, `button`, `animate`, `set`.
- **Attribute Cleansing**: Strips all `on*` inline handlers, `style`, `srcdoc`, `nonce`.
- **URL Sanitization**: Sanitizes `href`, `src`, `action`, `formaction`, `poster`, `cite` attributes, permitting only `http:`, `https:`, `mailto:`, `tel:`, `#`, `/`, `./`, `../`.

### 3. App ID Validation
App IDs are strictly validated via `assertSafeAppId()`:
```javascript
/^[A-Za-z][A-Za-z0-9_-]{0,63}$/
```
Attempting to register or open an app with invalid characters throws a runtime exception.

### 4. Credential Persistence Guard
`PrestigeStore.createStore()` enforces a credential protection rule. If `persistKey` contains sensitive terms (`token`, `secret`, `password`, `credential`, `authorization`, `permission`, `session`, `cookie`), store creation throws an error preventing sensitive credentials from leaking into unencrypted `localStorage`.

### 5. Web3 Transaction Security Guard
`web3TransactionGuard(host, txDetails)` (`typescript/src/ui/Dialogs.ts`) renders a high-security transaction confirmation overlay before Web3 transactions:

- Mounts at the dedicated security plane (`--prestige-plane-security`, z-index 999999).
- `txDetails` (`Web3TransactionDetails`, `typescript/src/types/web3.ts`): `{ action, to, value, data?, chainId }` — `value` is a `bigint` in wei (never a float).
- A `MutationObserver` rejects the transaction if injected code mutates the modal DOM (anti-extension-tampering).
- Confirmation only passes `isElementVisuallySafe()` (clickjacking defense: the confirm button must be the actual top-most element at the click point).

```javascript
const approved = await prestige.web3TransactionGuard(engine, {
  action: 'Send',
  to: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
  value: 1000000000000000n, // 0.001 ETH in wei
  chainId: 1
});
if (approved) { /* broadcast tx */ }
```

### 6. Secret Zeroing
Pass byte buffers holding credentials to `DisposalStack.ownSecret(buffer)` (`typescript/src/core/Memory.ts`) and their contents are zero-filled (`Uint8Array.fill(0)`) automatically when the owning window (or stack) is disposed — no secret survives in memory after teardown.

---

## 5. Complete Configuration Reference

```typescript
const prestige = new Prestige({
  // ── Mounting & Container ──
  container: document.body,          // Document or HTMLElement mount root (default: document)

  // ── Display Settings ──
  grid: false,                        // Enable background animated grid drift (default: false)
  gpuAcceleration: true,             // Apply hardware acceleration CSS rules (default: true)
  animations: true,                  // Enable FLIP, slide, and scale animations (default: true)
  particleExplosion: true,           // Enable Canvas 3D particle burst on close-all (default: true)

  // ── Shell Features ──
  dock: true,                        // Bottom application dock (default: true)
  topdock: true,                     // Top menubar circular dock (default: true)
  clock: true,                       // Top menubar live digital clock (default: true)
  session: true,                     // Save/restore window layout in localStorage (default: true)
  search: true,                      // Spotlight search overlay Ctrl+Space (default: true)
  windowSwitcher: true,              // Window switcher Ctrl+` (default: true)
  dockDragDrop: true,                // Drag-and-drop dock reordering & cross-zone moves (default: true)
  expose: true,                      // Hot corner Exposé / Mission Control (default: true)
  xray: true,                        // Glass Peek mode Alt+X (default: true)
  snap: true,                        // Window magnet snapping (top/left/right) (default: true)
  shakeToMinimize: true,             // Shake window to minimize all other windows (default: true)
  flickToMinimize: true,              // Flick window down rapidly to minimize (default: true)
  minimizedPreview: true,            // Hover dock item to preview minimized window (default: true)
  toastCenter: true,                 // Notification center panel and bell icon (default: true)
  lockScreen: false,                 // Privacy lock screen Ctrl+Shift+L (default: false)
  tiling: false,                     // Auto-grid tiling manager Ctrl+Alt+T (default: false)

  // ── Lock Screen Options ──
  lockPassword: 'prestige',          // Client-side UI password (default: 'prestige')

  // ── Titlebar Customization ──
  renderTitlebar: null,              // Custom titlebar renderer: (label, icon) => string | Node.
                                     // String output is treated as trusted developer markup —
                                     // <button> window controls and inline style survive, but
                                     // active vectors (script, iframe, on*, srcdoc, nonce,
                                     // unsafe URLs) are stripped. Escape the label yourself;
                                     // returning a DOM Node bypasses all scrubbing.

  // ── App Manifests ──
  apps: {
    dashboard: {
      title: 'Dashboard',            // Display label (fallback: manifest.label)
      icon: 'layout-dashboard',      // Offline Lucide icon name
      placement: 'dock',             // 'dock' | 'topdock' | 'hidden' | 'both' (default: 'dock')
      c1: '#fbe482',                 // Dock icon gradient start color
      c2: '#000000',                 // Dock icon gradient end color
      maximized: false,              // Open window pre-maximized (default: false)
      trustedHtml: false,            // Opt-in to HTML parsing (default: false)
      w: 780,                        // Default window width (falls back to DEFAULT_WINDOW_SIZES[appId])
      h: 540,                        // Default window height
      content: (appId, label, icon) => DOMNode | string
    }
  }
});
```

The lock screen is a client-side privacy overlay, not an authentication or
data-protection boundary. Do not use it as a substitute for server-side
authorization, session expiration, or encrypted storage.

---

## 6. Core JavaScript API Reference

### Initialization & Lifecycle

#### `new Prestige(config?: PrestigeConfig)`
Instantiates the Prestige engine instance.

#### `prestige.init() : Prestige`
Binds DOM listeners, initializes dock, topdock, keyboard shortcuts, clock, session restoration, and icon rendering.

#### `prestige.destroy() : void`
Tears down all open windows, aborts registered global event listeners, stops timers, clears DOM overlays, and resets internal state.

#### `Prestige.create(config?: PrestigeConfig) : Prestige`
Static factory method that instantiates and calls `.init()` immediately.

#### `Prestige.mixin(descriptor: object) : void`
Extends `Prestige.prototype` with custom methods.

---

### Window Operations

#### `prestige.openWindow(section: string, icon?: string, label?: string, dockBtn?: HTMLElement) : HTMLElement`
Opens an application window or toggles its state (restores if minimized, brings to focus if backgrounded).

#### `prestige.closeWindow(win: HTMLElement) : void`
Closes the window, triggers close animations, disposes its `DisposalStack`, and updates dock states.

#### `prestige.minimizeWindow(win: HTMLElement) : void`
Animates a window scaling down into its dock icon and marks it as minimized.

#### `prestige.restoreWindow(win: HTMLElement) : void`
Restores a minimized window to its previous geometry using FLIP transitions.

#### `prestige.toggleMaximize(win: HTMLElement) : void`
Toggles a window between its normal size/position and full-canvas zoom.

#### `prestige.focusWindow(win: HTMLElement) : void`
Brings the window to the top of the z-index stack (`zCounter`) and updates the active window indicator.

#### `prestige.closeAllWindows() : void`
Closes all open windows. Uses Canvas 3D particle explosion if `particleExplosion` and `animations` are enabled.

#### `prestige.explodeAndCloseAll() : void`
Force-closes all windows with the Canvas 3D particle burst regardless of the `particleExplosion`/`animations` flags (used internally by the double-click-to-close gesture).

#### `prestige.setWindowTitle(win: HTMLElement, title: string) : void`
Updates the text in the window titlebar.

#### `prestige.setWindowContent(win: HTMLElement, content: Node | string) : void`
Replaces the main content body of a window safely.

#### `prestige.getWindowContent(win: HTMLElement) : HTMLElement`
Returns the `.window-content-main` element for a given window.

---

### Shell Features & Tools

#### `prestige.registerApp(appId: string, manifest: AppManifest) : Prestige`
Registers a new application dynamically.

#### `prestige.setAppPlacement(appId: string, placement: 'dock' | 'topdock' | 'hidden' | 'both') : Prestige`
Changes an app's dock placement at runtime and persists the choice in `localStorage` (`prestige_placements`).

#### `prestige.resetAppPlacement(appId: string) : void`
Clears a persisted placement override for an app, falling back to its manifest `placement` (or `'dock'`), and re-renders the dock/topdock. Emits `placement:changed` with the resolved value.

#### `prestige.showSearch() : void`
Opens the Spotlight search overlay (`Ctrl+Space`).

#### `prestige.enableXRay() / prestige.disableXRay() / prestige.peekXRay()`
Toggles X-Ray glass peek mode.

#### `prestige.toggleExpose(enable?: boolean) : void`
Toggles corner-triggered Exposé / Mission Control window overview.

#### `prestige.lock() / prestige.unlock(password: string) : void`
Locks or unlocks the screen environment.

#### `prestige.notify(type: 'info' | 'success' | 'warning' | 'error', title: string, message?: string) : void`
Pushes a notification to the Toast Notification Center.

#### `prestige.getState() : Array<WindowState>`
Serializes currently open window geometries into a state array.

#### `prestige.setState(states: Array<WindowState>) : void`
Restores window geometries from a serialized state array.

---

## 7. Comprehensive Event System Index

Subscribe to shell events using `prestige.on(event, handler)` and unsubscribe using `prestige.off(event, handler)`.

```javascript
prestige.on('window:open', ({ section, win, icon, label }) => {
  console.log(`Window opened: ${section}`);
});
```

| Event Name | Payload Object | Description |
|---|---|---|
| `window:open` | `{ section, win, icon, label }` | Emitted when a window is created and mounted. |
| `window:close` | `{ section, win }` | Emitted when a window finishes closing and is unmounted. |
| `window:focus` | `{ win, section }` | Emitted when a window receives top focus. |
| `window:blur` | `{ win }` | Emitted when all windows lose focus (e.g., canvas click). |
| `window:minimize` | `{ win }` | Emitted when a window begins minimizing. |
| `window:restore` | `{ win }` | Emitted when a minimized window is restored. |
| `window:maximize` | `{ win }` | Emitted when a window is maximized. |
| `window:restore-maximize` | `{ win }` | Emitted when a maximized window returns to normal bounds. |
| `window:dragstart` | `{ win }` | Emitted when window drag begins. |
| `window:dragend` | `{ win }` | Emitted when window drag ends. |
| `window:resizestart` | `{ win, dir }` | Emitted when window resize begins (`dir`: `'nw'`, `'se'`, etc.). |
| `window:resizeend` | `{ win, dir }` | Emitted when window resize ends. |
| `window:snap` | `{ win, zone }` | Emitted when a window snaps (`zone`: `'top'`, `'left'`, `'right'`). |
| `xray:enable` | `{}` | Emitted when X-Ray glass peek mode is activated. |
| `xray:disable` | `{}` | Emitted when X-Ray glass peek mode is deactivated. |
| `expose:open` | `{}` | Emitted when Exposé / Mission Control opens. |
| `expose:close` | `{}` | Emitted when Exposé closes. |
| `search:open` | `{}` | Emitted when Spotlight search opens. |
| `search:close` | `{}` | Emitted when Spotlight search closes. |
| `tiling:enable` | `{}` | Emitted when window tiling layout is activated. |
| `tiling:disable` | `{}` | Emitted when window tiling layout is deactivated. |
| `screen:lock` | `{}` | Emitted when screen lock is activated. |
| `screen:unlock` | `{}` | Emitted when screen lock is unlocked. |
| `app:register` | `{ appId, manifest }` | Emitted when a new app is registered. |
| `placement:changed` | `{ appId, placement }` | Emitted when an app placement is updated. |
| `storage:error` | `{ key, error }` | Emitted when persisting shell state (dock order, placements, session) to `localStorage` fails. |

---

## 8. App Placement & Drag-and-Drop Engine

Prestige supports dynamic app placement across four locations:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TOP DOCK (30x30px Circular Icons)                                      │
│ [app: topdock] or [app: both]                                          │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ BOTTOM DOCK (52x52px Gradient Icons + Labels)                          │
│ [app: dock] or [app: both]                                             │
└────────────────────────────────────────────────────────────────────────┘
```

### Drag-and-Drop Operations (`typescript/src/core/DesktopEngine.ts`)
- **Dock $\leftrightarrow$ Topdock Cross-Zone Move**: Drag an item from the bottom dock up to the top menubar to assign `placement: 'topdock'`. Drag down to assign `placement: 'dock'`.
- **Reordering**: Drag items within the same dock bar to reorder.
- **Persistence**: Reordered lists are saved to `localStorage` under `prestige_dock_order` and `prestige_topdock_order`.
- **Placement Context Menu**: Right-click any dock/topdock icon to invoke a context menu to change placement, hide, or reset to default.

### Programmatic Context Menu API
Prestige exposes a generic context menu engine (`typescript/src/core/DesktopEngine.ts`) used by the dock/topdock placement menu, and available for any app content:

```javascript
prestige.showContextMenu({
  x: e.clientX,
  y: e.clientY,
  items: [
    { label: 'Cut', kbd: 'Ctrl+X', onclick: () => doCut() },
    { label: 'Copy', kbd: 'Ctrl+C', onclick: () => doCopy() },
    { sep: true },
    { label: 'Paste', checked: true, disabled: false, onclick: () => doPaste() },
  ]
});

prestige.hideContextMenu(); // close it (also auto-closes on outside click)
```

`ContextMenuItem` fields: `label`, `kbd`, `checked` (renders a `✓` gutter), `disabled`, `sep` (renders a divider), `onclick`. The menu flips to stay within the viewport and auto-dismisses on any outside click.

---

## 9. Window Management & Physics

### 8-Direction Resize System
Windows feature 8 distinct resize handles (`.window-resize-handle`):

```
 nw ────────── n ────────── ne
  │                         │
  w      [ WINDOW BODY ]    e
  │                         │
 sw ────────── s ────────── se (diagonal grip)
```

Handles enforce a strict minimum window geometry of $420\text{px} \times 280\text{px}$.

### Magnet Snap System
Dragging a window near canvas edges triggers snap preview indicators (`.snap-preview`):
- **Top Edge**: Snaps to full canvas maximize.
- **Left Edge**: Snaps to 50% split on the left half.
- **Right Edge**: Snaps to 50% split on the right half.

### Shake-to-Minimize
When dragging a window, Prestige tracks directional velocity sign changes in mouse movement. If $\ge 3$ directional zero-crossings with $>8\text{px}$ movement occur within $600\text{ms}$, all other open windows are minimized automatically.

### Flick-to-Minimize
Releasing a window drag with a downward velocity $> 1.1\text{px/ms}$ automatically triggers window minimization to the dock.

---

## 10. Extensible Component System (All 33 Primitives)

Components are registered globally on `Prestige.components` and generated via `os.createComponent(name, options)` or standalone factory functions.

### Complete Primitive Reference

#### 1. Button (`createBtn`)
```javascript
const btn = createBtn('Click Me', {
  variant: 'primary' | 'success' | 'danger' | 'ghost',
  size: 'sm',
  onclick: (e) => {},
  disabled: false
});
```

#### 2. Card (`createCard`)
```javascript
const card = createCard('Card Title', bodyDOMNode, { className: 'custom-card' });
```

#### 3. Field Container (`createField`)
```javascript
const field = createField('Label Text', inputElement, 'Help text below input');
```

#### 4. Input (`createInput`)
```javascript
const input = createInput({ placeholder: 'Enter value', value: 'Default', textarea: false, rows: 3 });
```

#### 5. Progress Bar (`createProgressBar` / `'progress'`)
```javascript
const progress = createProgressBar(65, 100, { label: 'Upload progress' });
progress.setValue(80);
progress.getValue(); // 80
```

#### 6. Tabs Container (`createTabs` / `'tabs'`)
```javascript
const tabs = createTabs([
  { label: 'General', content: node1, trustedHtml: false },
  { label: 'Security', content: node2 }
], { activeIndex: 0, onChange: (tab, index) => {} });
tabs.select(1);
```

#### 7. Alert Banner (`createAlert` / `'alert'`)
```javascript
const alert = createAlert({ type: 'info' | 'success' | 'warning' | 'danger', title: 'Note', message: 'Alert text', dismissible: true });
```

#### 8. Toggle Switch (`createSwitch` / `'switch'`)
```javascript
const toggle = createSwitch({ checked: true, label: 'Notifications', onChange: (checked) => {} });
toggle.setChecked(false);
toggle.isChecked(); // false
```

#### 9. Accordion (`createAccordion` / `'accordion'`)
```javascript
const accordion = createAccordion({
  multiple: false,
  items: [
    { title: 'Section 1', content: node1, open: true },
    { title: 'Section 2', content: node2 }
  ]
});
accordion.setOpen(1, true);
```

#### 10. Pagination (`createPagination` / `'pagination'`)
```javascript
const nav = createPagination({ total: 10, page: 1, onChange: (page) => {} });
nav.setPage(2);
```

#### 11. Skeleton Loader (`createSkeleton` / `'skeleton'`)
```javascript
const skeleton = createSkeleton({ count: 3, widths: ['100%', '80%', '60%'], height: '14px' });
```

#### 12. Empty State (`createEmptyState` / `'emptyState'`)
```javascript
const empty = createEmptyState({ icon: '◌', title: 'No Data', description: 'Get started by creating a record.', action: { label: 'Create', onClick: () => {} } });
```

#### 13. Avatar (`createAvatar` / `'avatar'`)
```javascript
const avatar = createAvatar({ name: 'Ada Lovelace', size: 'sm' | 'md' | 'lg', src: '/avatar.png' });
```

#### 14. Breadcrumb (`createBreadcrumb` / `'breadcrumb'`)
```javascript
const bc = createBreadcrumb({ items: [{ label: 'Home', href: '/' }, { label: 'Settings' }] });
```

#### 15. Tooltip (`createTooltip` / `'tooltip'`)
```javascript
const wrappedTrigger = createTooltip({ trigger: buttonNode, message: 'Tooltip description' });
```

#### 16. Dropdown Menu (`createDropdown` / `'dropdown'`)
```javascript
const dd = createDropdown({
  label: 'Actions',
  items: [
    { label: 'Edit', onClick: () => {} },
    { divider: true },
    { label: 'Delete', danger: true, onClick: () => {} }
  ]
});
```

#### 17. Stepper Workflow (`createStepper` / `'stepper'`)
```javascript
const stepper = createStepper({ steps: ['Draft', 'Review', 'Publish'], active: 0 });
stepper.setActive(1);
```

#### 18. Data Table (`createDataTable` / `'dataTable'`)
```javascript
const table = createDataTable({
  columns: [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true, value: (row) => row.name.toUpperCase() }
  ],
  rows: [{ id: 1, name: 'Alice' }],
  onRowClick: (row, index) => {}
});
table.setRows(newRows);
```

#### 19. Checkbox (`createCheckbox` / `'checkbox'`)
```javascript
const cb = createCheckbox({ label: 'Agree to terms', checked: false, onChange: (val) => {} });
cb.setChecked(true);
```

#### 20. Radio Group (`createRadioGroup` / `'radioGroup'`)
```javascript
const radio = createRadioGroup({
  label: 'Options',
  value: 'opt1',
  items: [{ value: 'opt1', label: 'Option 1' }, { value: 'opt2', label: 'Option 2' }]
});
radio.setValue('opt2');
```

#### 21. Select Dropdown (`createSelect` / `'select'`)
```javascript
const sel = createSelect({ options: [{ value: '1', label: 'One' }], value: '1' });
sel.setValue('1');
```

#### 22. Textarea (`createTextarea` / `'textarea'`)
```javascript
const area = createTextarea({ placeholder: 'Notes...', rows: 4 });
area.setValue('Text');
```

#### 23. Input Group (`createInputGroup` / `'inputGroup'`)
```javascript
const group = createInputGroup({ prefix: 'https://', input: { placeholder: 'example.com' }, suffix: '.org' });
```

#### 24. Segmented Control (`createSegmentedControl` / `'segmentedControl'`)
```javascript
const seg = createSegmentedControl({ items: [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }], value: 'day' });
seg.setValue('week');
```

#### 25. Search Input (`createSearchInput` / `'searchInput'`)
```javascript
const search = createSearchInput({ placeholder: 'Filter list...', onChange: (val) => {} });
```

#### 26. File Input (`createFileInput` / `'fileInput'`)
```javascript
const fileInput = createFileInput({ label: 'Choose File', accept: '.png,.jpg', multiple: false });
fileInput.getFiles(); // File[]
```

#### 27. Badge (`createBadge`)
```javascript
const badge = createBadge('Active', 'success' | 'warning' | 'danger' | 'info');
```

#### 28. Stat Card (`createStatCard`)
```javascript
const stat = createStatCard('99.9%', 'Uptime');
```

---

## 11. Reactive State Store, SWR Cache & URL Sync

### 1. Reactive Signal Store (`typescript/src/core/Store.ts`)
Creates Proxy-based reactive state stores:

```javascript
const userStore = prestige.store.createStore('user', {
  name: 'Alice',
  theme: 'dark'
}, {
  persistKey: 'app_user' // Auto-persists in localStorage under prestige_store_app_user
});

// Subscribe to state changes
const unsubscribe = userStore.$subscribe((prop, value, prev, target) => {
  console.log(`${prop} changed from ${prev} to ${value}`);
});

// Two-way DOM Input Binding
const unbind = userStore.$bindInput(inputElement, 'name');

// Raw state snapshot
const raw = userStore.$getRaw();
```

### 2. SWR Server Cache (`fetchSWR`)
Provides Stale-While-Revalidate caching with request deduplication:

```javascript
const data = await prestige.store.fetchSWR('api_key', async () => {
  const res = await fetch('/api/data');
  return res.json();
}, {
  ttl: 60000,                  // 1 minute cache lifetime
  staleWhileRevalidate: true,  // Serve stale data immediately, refetch in background
  force: false                 // Bypass cache
});

// Listen to cache revalidations
prestige.store.onCacheChange('api_key', (freshData) => {
  updateUI(freshData);
});
```

### 3. URL Query Parameter Window Sync
Synchronizes open windows directly with the URL bar (`?windows=app1,app2`):

```javascript
// Automatically syncs window open/close/minimize/restore events to URL
const restoredAppIds = prestige.syncUrlState();
```

### 4. In-Memory Content Cache
Caches arbitrary values keyed by string in a map owned by the desktop instance (cleared on `destroy()`):

```javascript
prestige.cacheContent('report:2026', { rows: 42 });   // store
const data = prestige.getCachedContent('report:2026'); // retrieve (or null)
prestige.clearContentCache('report:2026');             // remove one key
prestige.clearContentCache();                          // flush entire cache
```

---

## 12. Dialogs, Overlays & Notification System

### Promise-Based Dialog API (`typescript/src/ui/Dialogs.ts`)

All dialog methods display modal prompts and return Promises that resolve upon user decision.

```javascript
// 1. Info Dialog
await prestige.dialogInfo('Operation complete.');

// 2. Warning Dialog
await prestige.dialogWarning('Low storage space remaining.');

// 3. Danger / Error Dialog
await prestige.dialogDanger({ title: 'System Error', message: 'Failed to write record.' });

// 4. Alert Dialog
await prestige.dialogAlert('Action required.');

// 5. Confirmation Dialog (returns Promise<boolean>)
const confirmed = await prestige.dialogConfirm({
  title: 'Delete Resource',
  message: 'Are you sure you want to proceed?',
  danger: true,
  confirmText: 'Delete',
  cancelText: 'Cancel'
});

// 6. Prompt Input Dialog (returns Promise<string | null>)
const result = await prestige.dialogPrompt({
  title: 'Workspace Name',
  defaultValue: 'My Workspace',
  placeholder: 'Enter name...'
});

// 7. Save File Dialog (returns Promise<{ filename: string | null, confirmed: boolean }>)
const saveResult = await prestige.dialogSave({ defaultValue: 'report.pdf' });

// 8. Open File Dialog (returns Promise<FileList | null>)
const files = await prestige.dialogOpen({ multiple: true, accept: '.csv' });

// 9. Generic Dialog Engine (any DialogType, returns type-specific result)
const result = await prestige.dialogShow({
  type: 'confirm',
  title: 'Are you sure?',
  message: 'This cannot be undone.',
  confirmText: 'Proceed',
  danger: true
});
```

Every dialog method accepts either a plain string (used as the message) or a `DialogOptions` object: `{ type, title, message, icon, confirmText, cancelText, defaultValue, placeholder, noOverlay, danger, width, multiple, accept }`.

---

### Custom Modals & Side Drawers

#### Custom Modal (`prestige.customModal`)
```javascript
const modalValue = await prestige.customModal({
  title: 'Edit Preferences',
  width: 480,
  body: formDOMNode,
  buttons: [
    { label: 'Cancel', variant: 'ghost', value: null },
    { label: 'Save', variant: 'primary', value: 'saved' }
  ]
});
```

#### Side Drawer (`prestige.drawer`)
```javascript
const drawerApi = prestige.drawer({
  title: 'Filter Panel',
  side: 'right', // 'left' | 'right'
  width: 360,
  content: filterDOMNode,
  onClose: (reason) => {}
});

drawerApi.close();
```

---

### Notification & Toast Center (`typescript/src/core/DesktopEngine.ts`)

```javascript
// Push notification
prestige.notify('info' | 'success' | 'warning' | 'error', 'Title', 'Message body');

// Toast popup
const toastApi = prestige.toast('Message text', 'success', 3500);
toastApi.close();
```

- Notifications are stored in a history buffer (max 50 entries).
- Clicking the notification bell in the menubar opens the slide-out Notification Center (`#toast-center`).

---

## 13. Lucide Icon Registry Subsystem

Prestige includes an offline, curated SVG icon registry (`typescript/src/ui/lucide-icons-data.ts` + `typescript/src/ui/LucideIcons.ts`) based on Lucide Icons.

```html
<!-- HTML Placeholder -->
<i data-prestige-icon="search"></i>
```

```javascript
// 1. Programmatically create SVG Icon Element
const svgNode = $icon('calendar', { class: 'my-icon', title: 'Calendar' });

// 2. Convert all placeholders in container to rendered SVGs
renderIcons(document.body);

// 3. Inspect registered icon list
console.log(window.PrestigeIcons);
```

---

## 14. Desktop Gestures & Interactions

| Action / Gesture | Trigger | Result |
|---|---|---|
| **Window Drag** | Mousedown on `.window-titlebar` | Moves window; updates geometry. |
| **Shake Window** | Rapid multi-directional drag | Minimizes all other open windows. |
| **Flick Down** | Rapid downward drag release | Minimizes current window to dock. |
| **Double-Click Titlebar** | Double-click titlebar | Toggles maximize / restore. |
| **Magnet Snap** | Drag to top/left/right edge | Fullscreen or 50% split snapping with ghost preview. |
| **8-Direction Resize** | Drag any window edge/corner | Resizes window down to $420\times 280\text{px}$ minimum bound. |
| **Window Switcher** | `Ctrl+\`` (Backtick) | Displays visual window cards with live thumbnails. |
| **Spotlight Search** | `Ctrl+Space` | Opens application and content finder overlay. |
| **Glass Peek (X-Ray)** | `Alt+X` | Dims non-focused windows to reveal desktop background. |
| **Exposé** | Move cursor to any screen corner | Tiles all active windows into interactive overview grid. |
| **Privacy Lock** | `Ctrl+Shift+L` | Locks desktop with blur overlay and clock. |
| **Grid Tiling** | `Ctrl+Alt+T` | Auto-tiles all active windows into a non-overlapping grid. |
| **Force Close App** | Double-click dock/topdock icon | Immediately destroys window and purges all bound memory resources. |

---

## 15. CSS Custom Properties & Theme Tokens

All styling is managed via CSS tokens defined in `css/tokens.css`.

```css
:root {
  /* ── Brand Colors ── */
  --prestige-primary: #fbe482;
  --prestige-bg: #ffffff;
  --prestige-text: #000000;
  --prestige-text-secondary: #000000;

  /* ── Semantics ── */
  --prestige-success: #10b981;
  --prestige-warning: #f59e0b;
  --prestige-danger: #ef4444;

  /* ── Accent System ── */
  --prestige-accent: #fbe482;
  --prestige-accent-08: rgba(251, 228, 130, 0.08);
  --prestige-accent-20: rgba(251, 228, 130, 0.20);
  --prestige-accent-55: rgba(251, 228, 130, 0.55);

  /* ── Glass Overlays ── */
  --prestige-glass-06: rgba(255, 255, 255, 0.06);
  --prestige-glass-35: rgba(255, 255, 255, 0.35);
  --prestige-glass-88: rgba(255, 255, 255, 0.88);

  /* ── Geometry & Layout ── */
  --prestige-radius: 12px;
  --prestige-radius-lg: 18px;
  --prestige-radius-sm: 8px;
  --prestige-menubar-height: 40px;
  --prestige-dock-height: 80px;

  /* ── Typography ── */
  --prestige-font: 'Inter', system-ui, -apple-system, sans-serif;
  --prestige-font-mono: 'JetBrains Mono', monospace;
}
```

---

## 16. Performance Optimization & GPU Compositing

1. **Hardware Acceleration**: Windows and dock items utilize `will-change: transform, opacity`, `translateZ(0)`, and `backface-visibility: hidden`.
2. **Selective Glass Blurring**: Heavy backdrop blurs (`backdrop-filter: blur(...)`) are applied **only to focused (`.is-focused`) windows**, reducing compositor GPU cost from $O(N^2)$ to $O(1)$.
3. **Paint Boundaries**: `.window-body` uses `contain: paint layout style` to prevent DOM reflows inside a window from triggering parent desktop re-paints.
4. **Reduced Motion & Performance Overrides**: Setting `data-animations="false"` or `data-gpu="false"` on `<html>` instantly disables CSS keyframes, FLIP transitions, and heavy GPU layer allocations for low-power hardware.
