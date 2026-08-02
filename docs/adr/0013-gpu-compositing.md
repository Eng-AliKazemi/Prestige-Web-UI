# ADR-0013: GPU Compositing Layer for Smooth 60 fps Multi-Window Motion

## Status

Accepted (2026-08-02)

## Context

A desktop shell animates many independent surfaces at once — dragging windows,
snapping, minimize/zoom FLIP, dock bounce, Exposé. If every frame triggers a full
software layout and paint of the viewport, motion janks the moment several windows
move. GPU scheduling must be off the main thread.

## Decision

Add an optional **GPU compositing** layer (gated by `gpuAcceleration`, default
part of config in ADR-0005) that works with the browser's compositor:

- **`will-change: transform, opacity`** on constantly-moving surfaces to promote
  layers **before** animation, avoiding mid-motion "pop-in".
- **`translateZ(0)` / 3D backface hints** to move layers onto their own GPU texture
  early, so transform/opacity animations never trigger a reflow.
- **Selective `backdrop-filter`** — glass blur only where it is seen (menubar,
  window chrome, dialogs), never the whole canvas.
- Animations use transform/opacity only; **never** `left`/`top`.

Runtime control: off per-config (`gpuAcceleration: false`) or per-session
(`[data-gpu="false"]`), which neutralizes hints and CSS rules while remaining fully
functional for low-end/remote desktops.

## Consequences

- Positive: widgets/pane motion runs on the compositor at 60 fps even with many
  windows; FLIP, snap, dock bounce, Exposé, and X-Ray all benefit.
- Positive: fully optional and runtime-controllable for weak/remote targets.
- Negative: over-applying hints (e.g. `will-change` on everything) can waste memory;
  the discipline is to keep hints targeted.

## Alternatives considered

- Rely only on browser default optimization — janks under multi-window load.
- Strong `will-change` everywhere — memory bloat and degraded surface quality.