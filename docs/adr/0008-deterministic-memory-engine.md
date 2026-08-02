# ADR-0008: Deterministic Memory Engine — DisposalStack + Owned + Secret Zeroing

## Status

Accepted (2026-08-02)

## Context

A desktop shell opens and closes many windows over a long session. Tiny leaks in
listeners, timers, socket, or cached objects accumulate into jank and freezes.
Traditional GC or a bolted-on leak detector is non-deterministic — teardown should
be guaranteed the moment a window closes. Credentials must also not survive
teardown.

## Decision

Ship a **custom memory engine** (`typescript/src/core/Memory.ts`) with two
primitives implementing hybrid ownership:

- **`Disposable` + `DisposalStack`**: follow the TC39 explicit-resource-management
  proposal (`Symbol.dispose`). Every observer, timer, interval, and subscription is
  registered on to a stack; a single `dispose()` (or the `using` keyword) tears the
  group down in **LIFO order**. Registering after dispose raises a clear error.
- **affines `Owned`**: **single-ownership, move-only** resources; `.use()` borrow,
  `.dispose()` release. A `move()` transfers ownership and invalidates the old
  handle; use-after-move throws `Owned resource has already been moved or disposed`.
- **`ownSecret()`**: accepts a `Uint8Array`/`ArrayBuffer` credential and
  **zero-fills its bytes** on teardown so no secret survives in memory.

Every open window owns its own `DisposalStack`.

## Consequences

- Positive — teardown is deterministic, reverse-order, and per-window.
- Positive — the 178-test suite includes a stress test opening/closing 50 windows
  and asserting **zero** leftover DOM nodes, intervals, or listeners.
- Positive — moving ownership + secret zeroing hardens credential surfaces.
- Negative — authors must register every resource on the stack (documented in
  AI_INSTRUCTIONS `§14`).

## Alternatives considered

- Precise Ref counting — rejected in favor of an explicit ownership model.
- Global registry + process shutdown sweeps — rejected — lacks per-window
  granularity.