# ADR-0005: Every Feature Is Config-Driven — A Constructor Boolean Disables It at Runtime

## Status

Accepted (2026-08-02)


## Context

Customers embed the shell in very different environments: some need GPU
acceleration, some target low-end/remote VMs; some want the dock, some only the
menubar; some want gestures, some want none. Forking/patching the source per project
is the exact maintenance trap the project wants to avoid.

## Decision

Gate **every feature** behind a boolean flag in the `Prestige` constructor
(`gpuAcceleration`, `animations`, `particleExplosion`, `dock`, `topdock`, `clock`,
`search`, `windowSwitcher`, `dockDragDrop`, `expose`, `xray`, `snap`,
`shakeToMinimize`, `flickToMinimize`, `grid`, …). Setting an option to `false`
disables the feature at runtime with **no code change**. New features must be added
to the `FEATURE_DEFAULTS` table and the `PrestigeConfig` union — never as an
ungated hard toggle. GPU can additionally be disabled per-session via
`data-gpu="false"` on `<html>`.

## Consequences

- Positive — one config object adapts the shell to any product without forking.
- Positive — risky motions (GPU hints, particle explosions) can be turned off
  instantly for low-end or safety-constrained targets.
- Negative — every feature has a small branching cost and must account for both
  the on and off states in tests.
- Invariant — features are **gated**, never code-removed (ADR-0004 preserves the
  module structure).

## Alternatives considered

- Separate build variants per feature — rejected: combinatorial matrix and
  duplicate maintenance.
- Feature flags via CSS only — rejected: many features (dock, search, switcher)
  are behavioural and need JS gating.
