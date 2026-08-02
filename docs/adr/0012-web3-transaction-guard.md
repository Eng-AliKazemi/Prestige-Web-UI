# ADR-0012: Web3 Transaction Guard — Isolation, Tamper Detection, Clickjacking, `bigint`

## Status

Accepted (2026-08-02)

## Context

Web3 integrations confirm blockchain transactions with exact values. Naive prompts
are unsafe: floats corrupt wei, injected markup can re-skin or reposition the
confirm button above the intended target, and mutations can hide verification
details. The Web3 path must be exact, user-verifiable, and tamper-proof.

## Decision

Provide a purpose-built `web3TransactionGuard` overlay that renders at a dedicated
**security plane** (top z-index) before any transaction:

- **Exact values**: displays `action`, `to`, and `value` as a `bigint` in **wei**
  molecules (never a lossy float).
- **Tamper detection**: a `MutationObserver` watches the modal and `document.head`;
  any attempt to reposition, re-skin, or hide the confirm button causes the
  transaction to be **rejected**.
- **Clickjacking defense**: confirmation passes only if the confirm button is
  verifiably the top-most element at the click point, so a decoy label cannot be
  swapped in above it.
- **Isolated `postMessage` tier**: dialogs and cross-window communications use a
  hardened `postTargetOrigin` resolver rather than a wildcard.
- Reuses the atomic high-security dialog plane for signing, approve, and
  network-switch confirmations.

## Consequences

- Positive — blockchain amounts are exact; finishing surfaces are hardened against
  tampering and clickjacking.
- Positive — establishes the security precedent for the broader Web3 roadmap
  (wallet-connect, typed transactions, EIP-712).
- Trade-off — a visible, high-security confirmation step is intentional friction;
  the guard must keep evolving with the Web3 ecosystem.

## Alternatives considered

- Floating-point confirmation — rejected: precision loss corrupts transfers.
- Trusting the injected dApp UI to self-confirm — rejected: spoofable.
- Wildcard `postMessage` origin — rejected: poor isolation hygiene.