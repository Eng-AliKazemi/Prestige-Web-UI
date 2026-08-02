# ADR-0007: CSS Design-Token System — Zero Hardcoded Colors Outside `tokens.css`

## Status

Accepted (2026-08-02)

## Context

The shell's full identity is visual: accent (gold), glass overlays, shadows,
semi-visible radii and semantics. Hardcoded bytes scattered across 9+ CSS files
make rebranding or dark/light themming an archaeology project and invite drift.

## Decision

Centralize **every color, radius, shadow, and plane value** as a CSS custom
property prefixed `--prestige-*` in a single `css/tokens.css` file (accent at
multiple alphas, glass white overlays, shadow black overlays, semantic
success/warning/danger, layout radii/planes). Nothing outside `tokens.css` may
reference a bare hex. Changing one variable propagates to the whole shell; zero
hardcoded colors exist outside the token file.

## Consequences

- Positive — a new theme is a one-variable change; white/light to dark is
  mechanical.
- Disruptive: contributors must reference tokens, never literal hex — enforced by
  review/test (ADR-0018 encodes this).
- Positive — consistent brand and semantics across windows, dock, menubar, dialogs.

## Alternatives considered

- SCSS/SASS variables compiled to CSS — an extra compile step; the project ships
  plain CSS (ADR-0001). Custom properties win.
- Per-component inline colors — rejected: duplicate and drift-prone.