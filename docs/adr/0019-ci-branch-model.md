# ADR-0019: DEV-Branch Development Model with Gated CI Verification

## Status

Accepted (2026-08-02)

## Context

The project needs a reliable release cadence and a clear place for all development
while keeping a stable, deployable branch. Multiple CI workflows (unit/typecheck/
build/smoke/SRI/release checks) must be a gate, not decoration: red checks must stop
unstable promotions and never reach the published build.

## Decision

- **Two branch roles**: `main` is the stable, release-only branch; **`DEV`** is the
  integration branch where all development happens. Feature branches are short-lived,
  created from and merged into `DEV`. `main` only receives an agreed, reviewed, green
  snapshot flown in from `DEV` (never direct push/PRs for in-flight work).
- **Gated CI** (`.github/workflows/verify.yml` and friends):
  - `npm ci` + `npm audit --audit-level=high` pinned lock;
  - strict `typecheck` + `typecheck:tests`;
  - vitest suite **and** `@vitest/coverage-v8` coverage;
  - `npm run build` (ADR-0017) and the UMD smoke (ADR-0003);
  - `verify:package` consumer test and release checks (`scripts/verify.py`,
    `pip-audit`, headless browser);
  - "committed build assets are in sync" guard (ADR-0002) so `dist/` never drifts.
  Matrix over Ubuntu/macOS × node 18/20/22 to surface platform-only regressions
  (e.g., the macOS symlink/tmp failure fixed in the `verify-package`).
  Scheduled nightly-browser regression and release-on-tag workflows keep the
  release path continuously checked.

## Consequences

- Positive: `main` stays pristine; unstable code never blocks the release.
- Positive: comprehensive gates catch regressions early and prevent asset drift.
- Negative: a matrix of CI jobs is costly and must be kept green so it stays
  trusted.

## Alternatives considered

- Trunk-based with direct commits to `main` — rejected for release safety.
- Single-branch dev w/o build-sync guard — rejected; allows asset drift
  (ADR-0002).