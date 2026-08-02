# ADR-0014: Window Physics — Cascade, Drag, Resize, Magnet Snap, FLIP, Gestures

## Status

Accepted (2026-08-02)

## Context

The core value of a desktop shell is believable window behavior: draggable,
8-direction resizable, focus-stackable, minimize/restore/zoom, snapping, and
session-layout persistence. Users expect Mac-behavior (drag+pause FLIP animation,
shake-to-minimize, magnetic snap to top for fullscreen / edges for 50%).

## Decision

Implement a **window manager** (`core/WindowManager.ts`) with:

- **Raw mouse/touch** dragging + 8-direction resize (no HTML5 DnD for windows).
- **Cascade** positioning and proper **z-index** stacking; per-window `DisposalStack`
  from ADR-0008.
- **FLIP** animations for minimize/zoom/restore states (`.is-minimized`,
  `.is-zoomed`, `.is-focused`, `.is-restoring`, …) driven by CSS transitions on
  `transform`/`opacity` (ADR-0013).
- **Magnet snap**: drag to top edge = fullscreen; to left/right = 50% split.
- **Gestures**: shake-to-minimize-alls , flick-down-to-minimize, hot-corner
  Exposé/Mission Control, `Alt+X` X-Ray glass peek.
- `Ctrl+\`` window switcher with live thumbnails; `Ctrl+Space` spotlight search;
  session layout persistence via the store (ADR-0010).

## Consequences

- Positive — a genuinely desktop-grade experience; windows feel alive and
  learnable.
- Positive — deterministic teardown carries each window's resources (ADR-0005).
- Negative — physics/gesture code is substantial and gesture/regression-tested;
  each gesture is a browser compatibility surface.

## Alternatives considered

- HTML5 drag-and-drop for window move — rejected: poor feel, not precise.
- Animating `left`/`top` — rejected: forces software layout (ADR-0013).