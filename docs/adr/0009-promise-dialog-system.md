# ADR-0009: Promise-Based Dialog System; Native Browser Dialogs Are Banned

## Status

Accepted (2026-08-02)

## Context

The shell orchestrates many admin/end-user flows. Native `alert()`/`confirm()`/
`prompt()` block the event loop, break async/HTMX/hot-reload workflows, cannot be
styled, and look out of place inside a desktop shell. Callers also needed a way to
await a user's answer without callbacks chaining.

## Decision

Provide a **promise-based dialog/overlay system** on dedicated UI planes. Methods
`dialogInfo`, `dialogWarning`, `dialogDanger`, `dialogAlert`, `dialogConfirm`,
`dialogPrompt`, `dialogSave`, `dialogOpen`, plus toasts, custom modals, side
drawers, and the web3 transaction guard — all return `Promise`s accepting string or
object payloads. **Native `alert`/`confirm`/`prompt` are strictly banned** in the
shell and in any admin page built on it (enforced in `AI_INSTRUCTIONS.md`). The
dialog plane also resists clickjacking for the guard path (ADR-0012).

## Consequences

- Positive — async UI is composable; each dialog awaitable as a meaningful value;
- Positive — native features (blocking, ugly, unskinnable) are avoided everywhere.
- Negative — a dialog layer must be mounted and styled for the whole shell; each
  variant needs its own implementation.

## Alternatives considered

- Callback-style dialogs — rejected: promise composition is cleaner for complex
  flows.
- Reusing native dialogs "for now" — rejected outright for the event-loop and
  branding reasons above.