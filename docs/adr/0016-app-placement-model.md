# ADR-0016: App Placement Model — Dock / Topdock / Hidden / Both, with Drag-and-Reorder

## Status

Accepted (2026-08-02)

## Context

Users and deployments want apps discoverable in different places: some in the
bottom dock, some as circular top menubar icons, some only searchable, and some in
both. Layout should be configurable without changing app code — and users expect to
re-arrange the launcher visually.

## Decision

Every app registered via `registerApp(appId, manifest)` carries a
`manifest.placement` field:

- `"dock"` (default) — bottom dock button
- `"topdock"` — small circular iconin the top menubar
- `"hidden"` — not shown (accessible via `Ctrl+Space` spotlight)
- `"both"` — appears in both locations

Public APIs re-place apps at runtime (`setAppPlacement`, `resetAppPlacement`), and
`dockDragDrop: true` enables cross-zone drag-and-drop reordering of the launch bar
(dock and topdock). Placement changes emit events (`placement:changed`) notable to
listeners.

## Consequences

- Positive: app layout is config/placement-driven, not hardcoded route.
- Positive: users reorganize the launcher freely.
- Negative: a placement/drag-and-drop engine to maintain alongside the dock/topdock
  build.

## Alternatives considered

- Hardcode each app to one location — rejected: inflexible cross-deployment.
- Static config only (no runtime placement API) — rejected for live re-arrange
  support.