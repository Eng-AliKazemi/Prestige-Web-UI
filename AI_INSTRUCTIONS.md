# AI_INSTRUCTIONS.md — Meta-Prompt for AI Coding Agents

This document is the authoritative operating manual for AI coding agents
(Claude, GPT, Gemini, Copilot, Cursor, opencode, etc.) that contribute to the
**Prestige Web UI** project or build full applications **on top of it** (both
frontend and backend).

Read `AGENTS.md` first for the project's hard conventions. This file is the
deeper "how and why" meta-prompt: it explains the architecture, the exact file
layout, and the correct, efficient, and secure way to build UI and backends
with Prestige UI.

---

## Table of Contents

1. [What This Project Is](#1-what-this-project-is)
2. [Non-Negotiable Invariants](#2-non-negotiable-invariants)
3. [Repository Layout](#3-repository-layout)
4. [Source Architecture (`typescript/src`)](#4-source-architecture)
5. [CSS Architecture](#5-css-architecture)
6. [The Build & Verification Pipeline](#6-the-build-and-verification-pipeline)
7. [How a Page Is Rendered](#7-how-a-page-is-rendered)
8. [Building FRONTEND with Prestige UI](#8-building-frontend-with-prestige-ui)
9. [Building BACKEND with Prestige UI](#9-building-backend-with-prestige-ui)
10. [The Security Model (do not weaken)](#10-the-security-model-do-not-weaken)
11. [Efficiency & Performance Rules](#11-efficiency--performance-rules)
12. [Reactive Store & SWR Patterns](#12-reactive-store--swr-patterns)
13. [Extending the Shell (plugins, registry, modules)](#13-extending-the-shell-plugins-registry-modules)
14. [Test, Verify, Log, Commit](#14-test-verify-log-commit)

---

## 1. What This Project Is

**Prestige Web UI** (`prestige-ui`, v2.5.0) is a **zero-dependency** Web desktop
shell and component library. It was originally a proprietary C++/Qt commercial
UI, re-imagined for the web as strict **TypeScript compiled to standalone
vanilla JavaScript + CSS**.

Key facts an agent must always remember:

- **TypeScript is compile-time only.** What ships is plain ES modules
  (`dist/prestige.js`), a UMD classic script (`dist/prestige.umd.cjs` / `.js`),
  and `dist/prestige.css`. Consumers need **no bundler, no Node, no build
  step** — a `<script>` tag is enough.
- The shell provides a **dock**, **top menubar / topdock**, **draggable &
  resizable windows**, **dialogs**, **toasts/modals/drawers**, **Spotlight
  search**, **window switcher**, **Exposé**, **X-Ray**, **tiling**, **magnet
  snap**, **particle explosion**, **lock screen**, a **reactive store with
  SWR caching**, and a disposable **memory engine**.
- Every feature is **config-driven**: a constructor flag disables it at
  runtime. Never hard-remove a feature's code, gate it behind config.
- `dist/` is the **source of truth** (what ships). The editable sources are
  `typescript/src/*.ts` and `css/*.css`. **Backport changes to the sources
  before building.**

---

## 2. Non-Negotiable Invariants

These MUST never be violated. They are verified by tests and the spec.

1. **No `innerHTML` for dynamic content.** Build DOM structurally with
   `$tag()` / `$text()` / `appendChild`. Trusted-HTML is an explicit opt-in
   (`trustedHtml: true`) and must route through `sanitizeWith()` / the
   configured sanitizer. `srcdoc` is never allowed.
2. **No native browser dialogs.** `alert()`, `confirm()`, `prompt()` are
   **STRICTLY BANNED** in any page or admin UI. Use Prestige dialogs
   (`showFlashModal`-style / `dialogInfo`, `dialogConfirm`, etc.) instead.
   Native dialogs block the event loop and break async/HMR/HTMX workflows.
3. **No floating points for money / wei.** Use `bigint` (see `Web3TransactionDetails`).
4. **No hardcoded colors** anywhere in CSS. Every color is a
   `var(--prestige-*)` token from `css/tokens.css`.
5. **Every feature is config-gated.** Add to `FEATURE_DEFAULTS` +
   `PrestigeConfig` union, not just a hard toggle.
6. **Never commit secrets.** `PRESTIGE_SESSION_SECRET` and similar are env
   vars; the app/example refuses to start with a hardcoded fallback key.
7. **Preserve the module order** documented in `AGENTS.md` for both TS and CSS.
8. **Security defaults are secure.** Options may only weaken a safe default via
   a **loud** `console.warn`. Never silently disable a guard.

---

## 3. Repository Layout

```
./
├── AI_INSTRUCTIONS.md          # THIS file (agent meta-prompt)
├── AGENTS.md                   # Hard conventions (read first)
├── CHANGES.md                  # Mandatory change log (append)
├── README.md                   # Project marketing + usage
├── LICENSE                     # Apache-2.0
├── THIRD_PARTY_NOTICES         # Third-party licenses (Lucide icons)
├── package.json                # v2.5.0, build/test/verify scripts, exports map
├── tsconfig.json               # root TS config (build references)
├── css/                        # CSS sources (concatenated in strict order)
│   ├── tokens.css              # ALL --prestige-* CSS variables (75+)
│   ├── base.css                # reset, desktop-body, scrollbars, utilities
│   ├── desktop.css             # wallpaper, canvas, watermark, grid
│   ├── menubar.css             # top menubar, clock, topdock
│   ├── dock.css                # bottom dock
│   ├── windows.css             # window frames, FLIP states
│   ├── context-menu.css        # right-click menu
│   ├── components.css          # .btn, .card, component primitives
│   └── dialogs.css             # dialog + web3 security overlay
├── typescript/                 # TS source workspace (compile-time only)
│   ├── package.json            # TS build/test/typecheck/smoke scripts
│   ├── tsconfig.json           # strict, target ES2022, moduleResolution NodeNext
│   ├── tsconfig.test.json
│   ├── vite.config.ts          # ES + UMD library build
│   ├── vitest.config.ts        # happy-dom test env
│   ├── scripts/
│   │   ├── finalize-umd.mjs    # restores window.* helpers + global Prestige
│   │   └── smoke-umd.mjs       # loads UMD in happy-dom, asserts APIs
│   ├── src/                    # authoritative source
│   │   ├── index.ts            # barrel export of public API
│   │   ├── core/               # DesktopEngine, WindowManager, Store, Memory
│   │   ├── ui/                 # Components, Dialogs, ComponentRegistry, LucideIcons
│   │   ├── utils/              # dom, sanitize
│   │   └── types/              # public type contracts (barrel via index.ts)
│   └── tests/
│       ├── unit/*.test.ts
│       └── integration/desktop.test.ts
├── scripts/
│   ├── build.py                # concatenates css/*.css → dist/prestige.css + SRI
│   ├── verify.py              # release checks (build, UMD, ESM, SRI, import)
│   ├── verify-package.mjs     # npm pack + consumer install checks
│   └── generate_icon_registry.py
├── dist/                       # SOURCE OF TRUTH (build output, committed)
│   ├── prestige.js / .umd.cjs / .umd.js
│   ├── prestige.css
│   ├── index.d.ts (+ .map)
│   ├── manifest.json           # SRI hashes + fingerprinted filenames
│   └── {core,ui,utils,types}/  # flattened .d.ts
├── examples/
│   ├── index.html              # full component/dialog showcase
│   ├── dialogs-demo.html       # dialogs + overlays walkthrough
│   ├── lucid-dock.html         # dock/topdock demo
│   └── fastapi-demo/           # full-stack backend pattern (read this!)
│       ├── main.py             # FastAPI + Jinja2 + security hardening
│       ├── requirements.txt
│       ├── templates/index.html
│       └── static/             # copied build output
├── docs/
│   ├── PRESTIGE.md             # THE SPEC — do not invent behaviors
│   ├── MANUAL.md               # user manual
│   └── demo/ dist/ docs/       # build mirrors + examples
└── vendor/lucide/              # upstream icon sources (dev-only)
```

---

## 4. Source Architecture (`typescript/src`)

The TS is split strictly by responsibility. Keep modules single-purpose. The
**import order is mandatory** and defined in `AGENTS.md`; it matches dependency
direction (utils → ui → core → index).

| File | Responsibility |
|------|----------------|
| `core/DesktopEngine.ts` (2102 ln) | The `Prestige` class. Owns config freeze, dock/topdock binding, keyboard shortcuts, Spotlight, Exposé, X-Ray, switcher, tiling, toast center, particle explosion, lock screen, session, URL sync, component-registry facade. Delegates window logic to `WindowManager`. |
| `core/WindowManager.ts` | Window lifecycle, z-order, cascade, FLIP animations, gestures (drag/shake/flick), resize, magnet snap, isolation tiers. Per-window `DisposalStack`. |
| `core/Memory.ts` | `DisposalStack` (LIFO) + `Owned` (affine). TC39 `Symbol.dispose`. |
| `core/Store.ts` | `PrestigeStore`: reactive proxy stores, SWR cache, `$bindInput`/`$subscribe`/`$getSnapshot`, credential guards, optional AES-GCM encryption. |
| `ui/Components.ts` | Factory primitives (button, card, input, table, tabs, accordion, switch, dropdown, datatable, stepper, toast, modal, drawer, ...). |
| `ui/Dialogs.ts` | Promise-based dialogs (`info/warning/danger/alert/confirm/prompt/save/open`) + `web3TransactionGuard`. |
| `ui/ComponentRegistry.ts` | Extendable named-component factory registry. |
| `ui/LucideIcons.ts` + `lucide-icons-data.ts` | Curated offline SVG icon registry + `renderIcons()`. |
| `utils/dom.ts` | Safe structural builders: `$tag`, `$text`, `replaceContent`, `setSafeAttribute`, focus trap, `isolatedPostTargetOrigin`. |
| `utils/sanitize.ts` | XSS guards: `escapeHtml`, `sanitizeHtml`, `isSafeUrl`, `isSafeIframeSrc`, `assertSafeAppId`, `sanitizeWith`. |
| `types/*.ts` → `index.ts` | All public type contracts. |

### The `Prestige` class signature (key public API)
- `new Prestige(config)` / `Prestige.create(config)` — instantiate.
- `init()` / `destroy()` — mount teardown. Guards against double.
- `openWindow(section, icon?, label?, dockBtn?)`, `closeWindow`, `minimizeWindow`,
  `restoreWindow`, `toggleMaximize`, `focusWindow`.
- `registerApp(appId, manifest)` — declarative app registration.
- `setAppPlacement(appId, placement)` / `resetAppPlacement(appId)`.
- `getState()` / `setState(states)` / `syncUrlState()`.
- `on(event, fn)` / `off()` — event emitter (`window:*`, `placement:changed`, ...).
- `dialogShow / Info / Warning / Danger / Alert / Confirm / Prompt / Save / Open`.
- `toast(message, type?, duration?)`, `customModal(opts)`, `drawer(opts)`,
  `showContextMenu(opts)`.
- `ownResource`, `ownSocket`, `themeCache` / `cacheContent`.
- `.store` — a lazily-created `PrestigeStore`.
- Static: `Prestige.components`, `components.registerComponent(...)`, etc.

---

## 5. CSS Architecture

The CSS is concatenated **in strict order** by `scripts/build.py`:

```
tokens.css → base.css → desktop.css → menubar.css → dock.css
→ windows.css → context-menu.css → components.css → dialogs.css
```

- **`tokens.css` defines every color.** Accent = gold `#fbe482`
  (`--prestige-accent`, `--prestige-accent-XX` alphas), glass = white overlay
  (`--prestige-glass-XX`), shadow = black overlay (`--prestige-shadow-XX`),
  semantic = success/warning/danger. Layout: `--prestige-radius*`,
  `--prestige-menubar-height`, planes (`--prestige-plane-modal`,
  `--prestige-plane-security`).
- **Never reference a bare hex** outside `tokens.css`. Style must use tokens so
  theming changes one file.
- New states (e.g. a window class) go in the relevant file; if it's a new
  reusable component class it goes in `components.css`.
- Respect the existing animation `@keyframes` and `[data-gpu="false"]` override
  patterns in `windows.css`/`dialogs.css`.

---

## 6. The Build & Verification Pipeline

```bash
npm run build           # = npm run build:ts && python3 scripts/build.py
npm run build:ts        # cd typescript && npm run build  (vite + finalize-umd + tsc)
npm run test            # cd typescript && npm run test     (vitest)
npm run typecheck       # cd typescript && npm run typecheck (strict tsc)
npm run verify          # python3 scripts/verify.py && npm run verify:package
```

1. `vite build` → `dist/prestige.js` (ESM) + `dist/prestige.umd.cjs` (UMD).
2. `node scripts/finalize-umd.mjs` — post-process the UMD so the `Prestige`
   global is the class and `window.$id/$tag/$text/...` are restored, with a
   `__prestigeFinalize` marker guarding idempotence.
3. `tsc --emitDeclarationOnly` → `dist/index.d.ts` (+ per-module .d.ts).
4. `python3 scripts/build.py` — concatenate CSS + compute SRI +
   generate `manifest.json` (fingerprinted `prestige.<hash>.css/.js`) and copy
   into `examples/fastapi-demo/static/` and `docs/dist`.
5. `scripts/verify.py` — rebuild, `node --check` UMD, ESM import check, SRI
   verification, FastAPI demo import + route assertions.
6. `scripts/verify-package.mjs` — `npm pack`, install, consume the exports map.

**After any source change, always re-run `npm run build`** so `dist/` stays the
source of truth. Then `npm run typecheck` and `npm run test`.

---

## 7. How a Page Is Rendered

A Prestige shell page has a fixed DOM skeleton (see `examples/index.html`):

```html
<link rel="stylesheet" href="dist/prestige.css">
<script src="dist/prestige.umd.cjs" defer></script>
<body class="desktop-body">
  <div class="desktop-wallpaper"></div>
  <header class="menubar"> … topdock + clock + actions … </header>
  <main class="desktop-canvas" id="desktop-canvas"> windows live here </main>
  <div class="dock-wrap"><nav class="dock" id="dock"> .dock-item buttons </nav></div>
  <script>
    const os = new Prestige({ …config… });
    window._p = os;
    os.init();
    os.registerApp('overview', { title: '…', icon: 'log', content: () => buildContent() });
    // then open windows, syncing, etc.
  </script>
</body>
```

Dock items / topdock items use `data-section` (the section id), `data-icon` (a
Lucide registry name), `data-label`, and optionally `data-color`. The engine
delegates clicks to `openWindow(section, icon, label, btn)`.

**Key integration point:** `os.registerApp(id, manifest)` where `manifest`
carries `title`, `icon`, `placement` (`dock|topdock|hidden|both`), `tier`
(`native|isolated`), `src`, `c1/c2` (colors), `w/h`, `maximized`,
`trustedHtml`, and `content: (section, label, icon) => Node|string`.

---

## 8. Building FRONTEND with Prestige UI

### 8.1 Choose the right render path
- **DOM-first (preferred)** — build nodes with `$tag()`/`$text()`, attach real
  event listeners. Preserves handlers and lifecycle. Use everywhere security
  matters.
- **Trusted HTML (opt-in)** — `trustedHtml: true` + `sanitizeWith(custom, sanitizer)`.
  Only for content you control and trust (e.g., server-rendered without
  user-injected markup). Never use `innerHTML` yourself.
- Server-rendered pages (Jinja2/HTMX) hydrate local reactive stores on
  `DOMContentLoaded`.

### 8.2 Component factory catalog (use, don't reimplement)
`createBtn, createCard, createField, createInput, createTextarea,
createStatCard, createBadge, createTable, createProgress/ProgressBar,
createTabs, createAlert, createSwitch, createAccordion, createPagination,
createSkeleton, createEmptyState, createAvatar, createBreadcrumb,
createTooltip, createDropdown, createStepper, createDataTable,
createCheckbox, createRadioGroup, createSelect, createInputGroup,
createSegmentedControl, createSearchInput, createFileInput,
createToast, createModal, createDrawer`

They accept `html`/`trustedHtml` only when the module explicitly documents it.

### 8.3 Forms & `DataTable` two-way state
Use the store's reactive proxy:

```js
const prefs = os.store.createStore('demo_prefs', { name: 'Guest', role: 'Editor' }, { persistKey: 'demo_prefs' });
const inputs = [
  prefs.$bindInput($('#name'), 'name'),
  prefs.$bindInput($('#role'), 'role'),
  prefs.$subscribe(render),
];
// unbind per window close
```

### 8.4 App window content
Register an app and return a `Node` (a `.window-content-main` div wrapping your
sections). Call `os.openWindow(section, icon, label)` from a dock/topdock item.
Use `content` as a function so each window is fresh. Attach per-window cleanup
in `window:close` (see the FastAPI example for the pattern).

### 8.5 Accessibility & liveable things
- Interactive primitives get roles/labels (`role="switch"`, `aria-selected`, etc.). Preserve when wrapping.
- Always use your own `data-` attributes consistently; never rely on DOM order.

---

## 9. Building BACKEND with Prestige UI

The **`examples/fastapi-demo/`** is the reference full-stack pattern. It uses
Python + FastAPI + Jinja2, but the pattern applies to Flask, Django, Rails,
Laravel, Rust (Axum/Actix/Rocket), Go (net/http/Gin/Echo), and any server-side
stack that emits HTML.

Core idea: **Prestige is a client-side shell.** Your backend:
1. Serves the shell pages (via a template engine or SSR).
2. Serves API JSON endoints consumed by `PrestigeStore.fetchSWR`.
3. Persists the reactive store state (authed by sessions, CSRF-protected).
4. Is protected with strict security headers / CSP.

### 9.1 Serving static assets (SRI)
Read the built `manifest.json` and inject the fingerprinted + integrity-hashed
paths:

```jinja
<link  rel="stylesheet" href="/static/{{ assets['prestige.css']['file'] }}"
       integrity="{{ assets['prestige.css']['integrity'] }}" crossorigin="anonymous">
<script src="/static/{{ assets['prestige.js']['file'] }}"
        integrity="{{ assets['prestige.js']['integrity'] }}" crossorigin="anonymous" defer></script>
```

### 9.2 Auth + sessions (hardened)
The example demonstrates every required hardening:
- **Session secret is mandatory** (never a hardcoded fallback) — the app `raise`
  without the env var.
- `SessionMiddleware` with `secret_key`, `https_only`, `same_site="lax"`.
- CSRF: issue a token in the session, inject as `<meta name="prestige-csrf-token">`,
  require it in each `POST` via the `X-CSRF-Token` header, and **rotate on
  login** so a stolen pre-login cookie is useless.
- Constant-time credential compare (`secrets.compare_digest`).
- **Rate limiting** per client IP (only trust `X-Forwarded-For` from a
  configured trusted proxy → set `PRESTIGE_TRUSTED_PROXIES`).

### 9.3 Headers / CSP
`scripts` nonce-based CSP, pointing only at `'self'` + nonce, `object-src
'none'`, `frame-ancestors 'none'`, plus `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `Permissions-Policy`, and cache‑control palintext:
fingerprinted assets immutable; HTML `no-store`.

**Keep the CSP nonce** per-request (`request.state.csp_nonce`) so inline
`<script nonce="...">` and `<style nonce="...">` in templates are allowed
without `unsafe-inline`.

### 9.4 The two-way binding contract
- The page injects initial user JSON via `<script id="prestige-initial-user"
  type="application/json">{{ user | tojson }}</script>`.
- The client reads it into `os.store.createStore('userProfile', initialData, …)`.
- On Save it `POST`s to `/api/v1/user` with `Content-Type: application/json`
  and `X-CSRF-Token`, then reloads.
- Server validates with Pyndantic fields (length bounds), writes SQLite, audits
  to `audit_log`.

### 9.5 SWR (client) ↔ server
```ts
const data = await os.store.fetchSWR('fastapi_stats', async () => {
  const r = await fetch('/api/v1/stats');
  if (!r.ok) throw new Error('unavailable');
  return r.json();
}, { ttl: 10_000, staleWhileRevalidate: true });
os.system.store.onCacheChange('fastapi_stats', render);
```
Backend keeps `/api/v1/stats` session + rate‑limited and simulates latency to
confirm SWR caching is working.

### 9.6 Backend language-agnostic checklist
- Serve Prestige's fingerprint/SRI assets.
- Set CSP with nonce for the inline boot script; allowlist nothing dangerous.
- Whitelist hosts (`TrustedHostMiddleware`/equivalent).
- Session cookie `HttpOnly` + `Secure` (behind TLS) + `SameSite=Lax`.
- CSRF-token meta + header round-trip + rotation.
- Rate-limit per real client IP.
- Parametrized SQL (never string-concatenated).
- `bigint`/`decimal` for money/wei; never floats.
- Audit log for state-changing actions.

---

## 10. The Security Model

These are enforced by tests (`store-crypto`, `url-validation`,
`isolated-target-origin`, `security-config`, `core-lifecycle-security`, …).
Do **not** weaken; extend only.

1. **App IDs** — `/^[A-Za-z][A-Za-z0-9_-]{0,63}$/` via `assertSafeAppId` on every
   `openWindow`/`registerApp`/`setState`. Rejects dots, spaces, slashes.
2. **URLs** — `isSafeUrl` allows `http(s)`/`mailto:`/`tel:`/`#`/`/`/`./`/`../` only.
   `isSafeIframeSrc` allows `about:blank`/`http(s)`/relative only — never
   `javascript:`/`data:`/`blob:` for frames.
3. **Store credential guard** — plaintext `localStorage` refuses keys/values
   matching `token|secret|password|credential|authorization|permission|session|cookie`.
   Use `storage: 'encrypted'` with a strict, app-owned key provider for secrets.
4. **Isolation tier** — `isolated` apps render in a sandboxed iframe
   (`allow-scripts allow-forms`, no `allow-same-origin`), with
   `postTargetOrigin` pinning the `PRESTIGE_INIT` channel correctly.
5. **Trusted-HTML path** — only renders through a sanitizer; a custom sanitizer
   is a **trusted** boundary (its output isn't re-sanitized), so configure only
   one you trust.
6. **Web3 guard** — `web3TransactionGuard` confirms at the security plane
   z-index, re-checks the confirm button is visually on top (`isElementSafe`),
   and aborts if any DOM mutation happened in the modal or `<head>`.
7. **`nonce` + CSP** are the security boundary for inline scripts; never
   include `unsafe-inline`.

**The "no fake crypto" rule:** the library will **refuse** `security:
{ storage: 'encrypted' }` without a `storageKeyProvider`. It never generates a
key that would be lost on reload (a silently-encrypted blob you can't decrypt
is a data-loss bug). Provide a deterministic (e.g. PBKDF2-from-passphrase) key.

---

## 11. Efficiency & Performance Checklists

- **GPU**: leave `gpuAcceleration` on; don't add `will-change` to every element.
  Animate `transform`/`opacity` only. `[data-gpu="false"]` disables GPU hints.
- **Event delegation** for many nodes (dock). Use it when you have many items.
- **Animation classes** only set/remove; let CSS transitions drive FLIP
  sequences; never animate `left/top` for perf.
- **DOM minimization** — build nodes with `createElement` and cache references;
  don't re-query or re-render entire trees in hot paths.
- **Reactive updates** go through the store's `$subscribe`; don't re-render
  whole trees manually.
- Per-window lifecycle: attach listeners via the window's `DisposalStack`
  (or `window._disposal.listen/...`) so close tears everything down
  deterministically — the 50-window zero-leak test is the bar.
- Keep low-frequency timers coarse: the menubar clock ticks every 30s, not
  sub-second.

---

## 12. Reactive Store & SWR Patterns

### Store
- `os.store.createStore(id, initialData, { persistKey })` returns a proxy with
  `$subscribe`, `$bindInput`, `$getRaw`, `$getSnapshot`.
- Persistence keys and initial states are deep‑scanned; never persist the
  credential-like keys in plain text.
- `$getSnapshot()` returns a deep-frozen clone (cheap read for consumers).
- Prefer one id per logical feature; reuse if already created.

### SWR
- `fetchSWR(key, fetcher, { ttl, staleWhileRevalidate, force })`.
- `onCacheChange(key, render)` to live-update UIs.
- Same-key concurrent fetches are deduplicated/inflight.
- For live metrics choose a short `ttl` (e.g. 10s) + `staleWhileRevalidate`.

---

## 13. Extending the Shell (proper pattern)

Don't fork core. Two official extension surfaces:

1. **Components — `ComponentRegistry`**
   ```ts
   import { ComponentRegistry } from 'prestige-ui';
   Prestige.components.register('myThing', (options, instance) => {
     const el = document.createElement('div');
     return applyOptions(el, options);   // honors className/attributes/data/style
   });
   // now usable via os.createComponent('myThing', opts) and registry 'create'
   ```
2. **Apps / modular pages — `registerApp`**
   Register each screen as an app with its own `content` factory and
   `placement`. Load screens via the dock/topdock/search rather than
   hardcoded routes. See FastAPI example.
3. **Hooks — event emitter** `os.on('window:open'|'window:close'|…, fn)`
   for cross-cutting concerns (e.g., add a class to a window).

When you add a new feature to the shell, gate `PrestigeConfig` and wire a
binding method in `DesktopEngine`, never patch core internals.

---

## 14. Test Strategy, Verify, Log

- **Unit tests** live in `typescript/tests/unit/*.test.ts`; **integration**
  `integration/desktop.test.ts`. Run `npm run test` (all must pass; do not ship
  red).
- **Type checks** `npm run typecheck` is expected to be clean.
- After building run the UMD smoke (`node scripts/smoke-umd.mjs`) and ignition.
- **Every change MUST be logged in `CHANGES.md`** with a `YYYY-MM-DD HH:MM`
  entry. Simple change → one bullet (title + 1-line summary). Multi/sweeping
  change → several bullets, each stating exactly what changed, which file(s)
  and symbol(s). If nothing changed, still log a `No changes` entry.
- Before committing verify `dist/` is rebuilt so the source of truth is current,
  and run your feature only via the documented config surface.

---

## Design Principles to Internalize (from the spec)

- **Modularity & standalone** — each module is self-contained and singlepurpose;
  extensions add to `Prestige.prototype` or via the registry, not the core.
- **Config-driven** — any feature is a constructor option; usability without
  source edits.
- **Security by default** — XSS-safe builders, URL sanitization, credential
  guards, isolation tiers, constant-time compares, no naive fallback keys.
- **Production-grade** — zero runtime deps, deterministic dispose, verified
  release artifacts, SRI integrity.