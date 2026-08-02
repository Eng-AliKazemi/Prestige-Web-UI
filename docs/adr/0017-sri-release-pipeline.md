# ADR-0017: Release Pipeline — Vite + Finalize-UMD + TSC + build.py + SRI Manifests

## Status

Accepted (2026-08-02)

## Context

Publishing must regenerate consumers exactly reproducible, integrity-assurable
artifacts and keep the built distribution trustworthy. Multiple steps (ESM + UMD
+ CSS + type declarations + SRI) could drift or produce untraceable hashes.

## Decision

A two-stage, tooled release pipeline:

- **TypeScript**: `vite` (ESM config in `typescript/vite.config.ts`) bundles
  `typescript/src/index.ts` → `dist/prestige.js` (ES) and `dist/prestige.umd.cjs`
  (UMD); `typescript/scripts/finalize-umd.mjs` post-processes the UMD to expose the
  `Prestige` global and restore `window.*` helpers (ADR-0003); `tsc
  --emitDeclarationOnly` emits `dist/index.d.ts` + per-module declarations.
- **CSS / integrity:** `scripts/build.py` concatenates `css/*.css` in the module
  order (ADR-0004) into `dist/prestige.css` and generates content-hashed
  finger-printed assets plus `dist/manifest.json` carrying **SRI** integrity hashes,
  and copies mirror assets into `examples/fastapi-demo/static/` and `docs/dist`.

Fingerprinted, SRI-hashed filenames are read from the manifest and injected with
`integrity="…" crossorigin="anonymous"` into production templates.

## Consequences

- Positive — reproducible, integrity-protected, fingerprintable assets.
- Positive — a FastAPI/django/Rails base can reference SRI-safe builds automatically.
- Negative: the pipeline is multi-step; CI is responsible for running it before
  verification (ADR-0019, ADR-002).

## Alternatives considered

- A single hand-written makefile-like concatenation — rejected: no ESM/UMD, no SRI.
- No SRI (only content-Hashan) — rejected: integrity is required for third-party
  prevalence/trust.