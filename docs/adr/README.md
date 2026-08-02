# Architecture Decision Records — Prestige Web UI

This directory records the significant architectural decisions behind
**Prestige Web UI** (v2.5.0). Each ADR captures the **context**, the **decision**,
the **consequences**, and the **alternatives considered**, so that the *why* behind
the codebase survives long after a specific line of code has moved.

ADRs are immutable in intent: a decision is never silently reversed. If a decision
must change, supersede it with a new ADR that references the old one.

## Index

| # | Decision |
|---|----------|
| [0001](0001-standalone-vanilla-js-from-strict-typescript.md) | Standalone, zero-dependency vanilla JS — TypeScript is compile-time only |
| [0002](0002-dist-as-source-of-truth.md) | `dist/` is the source of truth; sources are backported before every build |
| [0003](0003-umd-finalizer-window-helpers.md) | UMD finalizer restores the `Prestige` global and `window.*` DOM helpers |
| [0004](0004-modular-single-responsibility-order.md) | Modular, single-responsibility modules with a strict, mandatory build order |
| [0005](0005-config-driven-features.md) | Every feature is config-driven — a constructor boolean disables it at runtime |
| [0006](0006-dom-first-rendering.md) | DOM-first structural rendering; `innerHTML` is banned for dynamic content |
| [0007](0007-design-token-theming.md) | CSS design-token system — zero hardcoded colors outside `tokens.css` |
| [0008](0008-deterministic-memory-engine.md) | Deterministic memory engine: `DisposalStack` + `Owned` + secret zeroing |
| [0009](0009-promise-dialog-system.md) | Promise-based dialog/overlay system; native browser dialogs are banned |
| [0010](0010-reactive-store-swr.md) | Reactive store with signals, SWR cache, URL sync, and a credential guard |
| [0011](0011-security-by-default.md) | Security by default: sanitizer, app-ID validation, URL policy, defense-in-depth |
| [0012](0012-web3-transaction-guard.md) | Web3 transaction guard: isolation, MutationObserver, clickjack, `bigint` |
| [0013](0013-gpu-compositing.md) | GPU compositing layer for smooth 60 fps multi-window motion |
| [0014](0014-window-physics.md) | Window physics: cascade, drag, resize, magnet snap, FLIP, gestures |
| [0015](0015-registry-and-app-extensions.md) | Extension via component registry and `registerApp` — never fork core |
| [0016](0016-app-placement-model.md) | App placement model (dock / topdock / hidden / both) with drag-and-drop |
| [0017](0017-sri-release-pipeline.md) | Release pipeline: vite + finalize-umd + tsc + build.py + SRI manifests |
| [0018](0018-ai-agent-meta-prompt.md) | AI-coding-assistant meta-prompt codifies invariants for agents and humans |
| [0019](0019-ci-branch-model.md) | DEV-branch development model with gated CI verification |

The ADRs are ordered to read as a narrative: *why* the product is what it is,
from distribution strategy through rendering, memory, security, and workflow.