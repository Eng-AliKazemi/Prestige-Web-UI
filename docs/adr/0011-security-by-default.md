# ADR-0011: Security by Default — Sanitizer, App-ID Validation, URL Policy, Defense-in-Depth

## Status

Accepted (2026-08-02)

## Context

This shell renders untrusted, user-derived and AI-generated content and is aimed
pages. Security must be the default, not an afterthought: a single escaped or
unvalidated string must not produce an XSS vector or a credential leak.

## Decision

Adopt a layered, defense-in-depth security default (`utils/sanitize.ts` and the
store security config):

- **Text-first**: strings treated as plain text by default; HTML only via
  `trustedHtml: true`, routed through a **Tree-Walker sanitizer** that drops
  `script`, `style`, `iframe`, `object`, `embed`, `form`, `input`, `button`, and
  SVG vector/network tags (`use`, `image`, `foreignObject`, `animate*`).
- **URL policy**: URL-bearing attributes restricted to `http:`, `https:`, `mailto:`,
  `tel:`, `#`, `/`, `./`, `../`; inline `on*`, `style`, `srcdoc`, and `nonce` stripped.
- **App-ID validation**: strict `/^[A-Za-z][A-Za-z0-9_-]{0,63}$/` on
  `openWindow`/`registerApp`/`setState`.
- **Credential guard**: plaintext storage rejects sensitive keys (ADR-0010).
- **Web3 guard + isolation tier**: isolated, sandboxed iframe
  (`allow-scripts`, no `allow-same-origin`), `postTargetOrigin` pinning (ADR-0012).
- Security options may only weaken a default via a **loud** `console.warn`; guards
  are never silently disabled.

## Consequences

- Positive — the shell is safe to embed exactly as published; escape is always
  opt-in and sanitized.
- Positive — centralized, reviewable security primitives.
- Negative — trusted-HTML authors configure a trusted sanitizer boundary.

## Alternatives considered

- Trust external sanitizer (e.g. DOMPurify) by default — a dependency; the
  project prefers its own dependency-free Tree-Walker, but supports plugging a
  custom sanitizer.