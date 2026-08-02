# ADR-0004: Modular, Single-Responsibility Modules with a Mandatory Build Order

## Status

Accepted (2026-08-02)


## Context

A desktop shell naturally attracts "god objects" — the `Prestige` class could
easily absorb windowing, state, dialogs, memory, and rendering. That coupling makes
individual features hard to reason about, test, disable, or extend independently.

## Decision

Split the engine into focused modules under `typescript/src/`, each with **exactly
one responsibility**, and define a **strict import/build order to respect
dependency direction (utils → ui → core → index)**: `utils/dom.ts`,
`utils/sanitize.ts`, `utils/lucide-icons-data.ts`, `ui/LucideIcons.ts`,
`ui/ComponentRegistry.ts`, `core/Memory.ts`, `ui/Components.ts`, `ui/Dialogs.ts`,
`core/Store.ts`, `core/WindowManager.ts`, `core/DesktopEngine.ts`, `index.ts`. The
CSS concatenation has the same property (`tokens.css → base → desktop → menubar →
dock → windows → context-menu → components → dialogs.css`).

## Consequences

- Positive — each subsystem can be tested and replaced in isolation.
- Positive — the engine assembles subsystems that each read from the DOM and the
  shared design tokens, so nothing is duplicated.
- Negative — a new feature must know which module and where in the order it goes
  (documented in `AGENTS.md` and `AI_INSTRUCTIONS.md`).
- Conventions — internal methods are prefixed `_`; window lifecycle uses state
  classes (`.is-minimized`, `.is-focused`, …); the module order is verified by the
  build pipeline.

## Alternatives considered

- A single monolithic `Prestige.ts` — rejected: hard to test and extend.
- Allow free imports across modules — rejected: breaks determinism and the
  UMD finalizer's load order assumptions.
