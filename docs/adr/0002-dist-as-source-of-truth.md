# ADR-0002: `dist/` Is the Source of Truth — Sources Are Backported Before Building

## Status

Accepted (2026-08-02)

## Context

The project has two realities: **editable sources** (`typescript/src/*.ts` and
`css/*.css`) and **published artifacts** (`dist/prestige.js`,
`dist/prestige.umd.cjs`, `dist/prestige.css`, `dist/index.d.ts`). If a contributor
edits the sources but forgets to rebuild, or edits the bundle directly, the
published package and the editable source drift apart, and the next build silently
overwrites manual fixes.

## Decision

Treat **`dist/` as the authoritative build output that is committed to the repo**,
and enforce a hard rule: **any new feature is backported to `typescript/src/` and
`css/*.css` before running the build**. After any source change, `npm run build`
must be re-run so `dist/` is regenerated from the sources. CI verifies the
committed assets are in sync and fails if `git status` shows changes under
`dist`, `examples/fastapi-demo/static`, `docs/dist`, or `docs/demo` after a build.

## Consequences

- Positive — the published package is always reproducible from sources.
- Positive — CI's "committed build assets are in sync" gate catches forgotten
  rebuilds automatically (ADR-0019).
- Negative — a full rebuild is required for every change, including one-line docs
  edits that happen to touch the bundle.
- Rule: never hand-edit `dist/`; always rebuild.

## Alternatives considered

- Treat `dist/` as gitignored generated output — rejected: static hosts and
  package metadata need committed, SRI-hashed assets (ADR-0017).