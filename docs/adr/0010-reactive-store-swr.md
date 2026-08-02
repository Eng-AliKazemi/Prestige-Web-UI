# ADR-0010: Reactive Store with Signals, SWR Cache, URL Sync, and a Credential Guard

## Status

Accepted (2026-08-02)

## Context

Concurrent AI/admin dashboards need live application state bound across pages plus
cache freshness guarantees (stale-while-revalidate). Re-fetching on every render,
or scattering state through globals, hurts jank and correctness. State also holds
credentials that must never reach `localStorage`.

## Decision

Provide a **reactive store** module (`core/Store.ts`, `PrestigeStore`):

- **Signals/proxy state**: `createStore(id, data, { persistKey })` returns a proxy
  with `$subscribe`, `$bindInput` (two-way form binding), and `$getSnapshot`
  (deep-frozen clone for cheap reads).
- **SWR caching**: `fetchSWR(key, fetcher, { ttl, staleWhileRevalidate, force })`
  deduplicates in-flight identically-keyed fetches and offers `onCacheChange` for
  live UI updates.
- **URL sync**: state can round-trip through the URL (`syncUrlState`).
- **Credential guard**: plaintext persistence rejects sensitive keys anywhere in
  the blob (`token|secret|password|credential|authorization|session|cookie`).
  Opt-in `storage: 'encrypted'` requires an app-owned AES-GCM
  `storageKeyProvider`; the library **refuses** to silently generate a throwaway
  key, because a lost key is data-loss.

## Consequences

- Positive: reactive UIs re-render cheaply and locally; live metrics stay fresh
  with a short TTL + SWR.
- Positive: credentials cannot persist in plaintext.
- Upfront: isolated secrets require the optional encrypted-storage policy and a
  real key provider.

## Alternatives considered

- Global mutable event objects — no reactivity, no SWR.
- A full reactive framework (Signals/External state lib) — too heavy and violates
  zero-dependency (ADR-0001).
- Per-render fetch — rejected: jank and too many requests.