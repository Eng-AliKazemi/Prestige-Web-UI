# ADR-0018: AI-Coding-Assistant Meta-Prompt — `AI_INSTRUCTIONS.md` + `AGENTS.md`

## Status

Accepted (2026-08-02)

## Context

The project is developed with AI coding assistants (opencode, Claude, GPT, Gemini,
Copilot, Cursor). A desktop shell imposes unusually strict invariants (no dynamic
`innerHTML`, no native dialogs, config-gated features, token theming, backport to
`dist/` before build). A generic assistant could rediscover these the hard way —
or degrade the trust of the codebase without a guard.

## Decision

Publish a dedicated **meta-prompt** operating manual for AI agents, `AI_INSTRUCTIONS.md`,
together with the hard-conventions file `AGENTS.md`:

- **Non-negotiable invariants** — no dynamic `innerHTML`, no native
  `alert/confirm/prompt`, config-gated features, no hardcoded colors, backport to
  `dist/` before building, never commit secrets.
- **Architecture map** — every module under `typescript/src/` and its
  responsibility, plus the mandatory TS and CSS build orders (ADR-0004).
- **Build + verification pipeline** — how `dist/` becomes the source of truth
  (ADR-0002, ADR-0017).
- **Full-stack reference** — the FastAPI integration pattern: sessions, CSRF,
  rate-limiting, and nonce-CSP (ADR-0017).
- **Security model** — app-ID validation, URL sanitization, credential guard,
  isolation tier, Web3 guard (ADR-0011/0012) with the rule that these are never
  silently weakened.
- **Efficiency rules** — GPU compositing, FLIP, disposal-stack teardown, and the
  50-window zero-leak bar (ADR-0013, ADR-0008).

The meta-prompt encodes the recurring verify-and-log loop as non-negotiable:
every change returns with `npm run build`, `npm run typecheck`, `npm run test`, and
a `CHANGES.md` entry.

## Consequences

- Positive: humans and AI agents internalize invariants on the first pass instead
  of rediscovering them; review becomes diff-verification.
- Positive: security defaults are encoded, not forgotten.
- Constraint: the met-document must be kept in sync with the codebase.

## Alternatives considered

- No meta-prompt (rely on model common sense) — rejected: invariant drift and
  repeated mistakes.

## Considered

- Reuse only `AGENTS.md` — split into hard rules (AGENTS) + explainer (AI_AGIN) so
  each stays scannable.