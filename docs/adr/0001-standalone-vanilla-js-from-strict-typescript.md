# ADR-0001: Standalone, Zero-Dependency Vanilla JS — TypeScript Is Compile-Time Only

## Status

Accepted (2026-08-02)

## Context

Prestige Web UI originated as a proprietary **C++/Qt** commercial interface. The
web re-imagining had to ship a desktop shell that any stack — Python, Rust, Go,
Ruby, Rails, HTMX, or a plain static page — can embed with nothing more than a
`<script>` tag and a `<link>`. Forcing consumers to install Node, a bundler, or a
build step would break every integration target.

Yet the shell is large and complex: drag & resize, z-stacking, dialogs, reactive
state, a memory engine, and a Web3 guard. Writing it in untyped JS would make the
invariants unreadable and multiply the regression surface.

## Decision

Ship the entire shell written in **strict TypeScript** (`noImplicitAny`,
`strictNullChecks`, `strictFunctionTypes`, …) but treat TypeScript **purely as a
compile-time tool**. The compiled artifacts are standalone plain ES modules plus a
UMD bundle and CSS: `dist/prestige.js`, `dist/prestige.umd.cjs`,
`dist/prestige.css`, `dist/index.d.ts`. Consumers run the compiled JS and never
build anything themselves.

## Consequences

- Positive: types double as API documentation; invalid app manifests and dialog
  options fail in the editor and in CI, long before a browser.
- Positive: zero runtime overhead from the type system — types are erased.
- Negative: TypeScript is a second internal toolchain that must be kept in
  `devDependencies` and maintained.
- Trade-off: runtime behaviour is not type-guaranteed, so a strong test suite and
  CI gates are mandatory (ADR-0002, ADR-0019).

## Alternatives considered

- Ship raw TypeScript and require consumers to compile — rejected; violates the
  zero-build integration promise.
- Author directly in JavaScript with JSDoc types — rejected at this scale; strict
  TS gives clearer structure and safer refactors.