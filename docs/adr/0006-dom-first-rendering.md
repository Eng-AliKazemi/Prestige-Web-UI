# ADR-0006: DOM-First Structural Rendering; `innerHTML` Is Banned for Dynamic Content

## Status

Accepted (2026-08-02)

## Context

The shell renders untrusted and user-derived content into windows, dialogs, and
components. Assigning `innerHTML` is the single most common XSS vector in web
interfaces (script injection, markup smuggling), and it destroys existing event
listeners and lifecycle ownership on every re-render.

## Decision

Build all DOM **structurally** with the typed factories `$tag()` / `$text()` (DOM
`createElement` + `appendChild`). `innerHTML` and `srcdoc` are **never** used for
dynamic content. Trusted HTML is an explicit opt-in (`trustedHtml: true`) and must
route through the sanitizer (`sanitizeWith()` / a configured custom sanitizer)
described in ADR-0011. `use`, `image`, `foreignObject`, `animate*` SVG tags, form
controls, and inline `on*`/`style`/`src` attributes are stripped by that path.

## Consequences

- Positive — injected markup cannot execute; handlers and ownership survive
  re-renders because real nodes are retained.
- Positive: CPU/Generator-friendly large trees reflow less (ADR-0013).
- Negative: building complex markup with factories is more verbose than a string.
- Invariant: helpers expose the structural builders; never `innerHTML`.

## Alternatives considered

- Client-side rendering via a string-template engine — rejected: every
  interpolation site is a possible injection point.
- Letting applications pass raw HTML freely — rejected: undermines the security
  default (ADR-0011).