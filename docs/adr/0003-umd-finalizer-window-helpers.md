# ADR-0003: UMD Finalizer Restores the `Prestige` Global and `window.*` DOM Helpers

## Status

Accepted (2026-08-02)


## Context

Consumers use the shell two different ways: classic `<script src="dist/prestige.umd.cjs">`
for server-rendered/static pages, and the ESM `dist/prestige.js` for modern
applications. The UMD wrapper produced by a generic bundler exposes an `exports`
namespace object, but the community and the examples expect a top-level **`Prestige`
class global** plus a set of ergonomic helpers (`$tag`, `$text`, `$id`, `createBtn`,
`createCard`, `renderIcons`, …) — historically `window.*` globals.

## Decision

Post-process the UMD bundle via `typescript/scripts/finalize-umd.mjs` so that after
it runs: the **`Prestige` global is the class itself** (not a namespace), and the
vanilla `window.*` helper functions are restored. A `__prestigeFinalize` marker on
the global guards idempotence so re-including the script does not double-run the
finalizer.

## Consequences

- Positive — a plain `<script>` tag works exactly as documented in the examples:
  `new Prestige({...})`, `renderIcons()`, `$tag(...)`, etc.
- Positive — the ESM build and the UMD build stay behaviourally equivalent.
- Negative — the finalizer is an extra build step that must run in CI (ADR-0017)
  and must keep the idempotence marker correct.

## Alternatives considered

- Hand-write the UMD wrapper — rejected; too error-prone and hard to maintain.
- Document only the ESM import and drop globals — rejected; breaks the
  server-rendered/HTMX integration target that depends on tag-based loading.
