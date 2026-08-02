# ADR-0015: Extension via Component Registry and `registerApp` — Never Fork Core

## Status

Accepted (2026-08-02)

## Context

Customers and integrators repeatedly need to add their own UI primitives (a custom
card, table, dashboard widget) and full screens. If extending required patching
`_core/DesktopEngine.ts_` or the bundle, every shell instance would diverge and each
upstream release would break.

## Decision

Offer two first-class extension surfaces and **ban forking core**:

- **`ComponentRegistry`**: `Prestige.components.register('myThing', (options,
  instance) => Node)`; primitives then usable via `os.createComponent(...)` and by
  the registry. Honors `class`/attributes/`data`/`style` uniformly.
- **`registerApp(appId, manifest)`**: declare a screen with `title`, `icon`,
  `placement`, `tier`, `src`, colors, size, and a `content` factory — no hardcoded
  routes; screens are launched via dock/topdock/search.
- **Hooks**: `os.on('window:open'|'window:close'|…)` event emitter for
  cross-cutting concerns.

New core behaviors are added to `Prestige.config` (ADR-0005) and implemented in the
owner module, not hand-patched.

## Consequences

- Positive: capabilities and apps are modular, testable, and merge-safe across
  upgrades.
- Positive: the security surface (ADR-0011/0012) covers apps automatically.
- Negative: a registry API to learn and maintain; must keep IDS validated
  (ADR-0011).

## Alternatives considered / rejected

- Letting developers patch `DesktopEngine.ts` directly — rejected: forks and drift.
- Treating `registerApp` as a plugin manager — this IS the canonical modern loading
  pattern (see AGENTS.md "respect Prestige UI modular design"), so it is adopted
  rather than replaced.