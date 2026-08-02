/**
 * Reactive state store and SWR cache type contracts. Matches
 * `docs/TYPESCRIPT.md` Phase 1 / Phase 3.
 */
import type { StorageKeyProvider } from './desktop.js';

/** Store change notification signature (matches `$subscribe` callback). */
export type StoreChangeListener<T> = (prop: keyof T, value: unknown, prev: unknown, target: T) => void;

/** Options accepted by `PrestigeStore.createStore()`. */
export interface StoreOptions {
    /** localStorage key namespace. Rejected if it matches credential patterns. */
    readonly persistKey?: string;
    /** Optional per-key validator guards; a falsy result throws on write. */
    readonly schema?: Record<string, (val: unknown) => boolean>;
}

/** Options accepted by the `PrestigeStore` constructor (persistence policy). */
export interface PrestigeStoreOptions {
    /** Persistence policy. `'deny-secrets'` (default) refuses credential-like
     *  keys; `'encrypted'` transparently encrypts persisted state with an
     *  app-owned key from `keyProvider`. */
    readonly storage?: 'deny-secrets' | 'encrypted';
    /** Supplies the AES-GCM key used by `'encrypted'` persistence. Required
     *  iff `storage === 'encrypted'`. */
    readonly keyProvider?: StorageKeyProvider;
}

/** Options accepted by `PrestigeStore.fetchSWR()`. */
export interface SWROptions {
    /** Cache lifetime in milliseconds. Defaults to 60000. */
    readonly ttl?: number;
    /** Serve stale data immediately while revalidating in the background. */
    readonly staleWhileRevalidate?: boolean;
    /** Bypass the cache and force a fresh fetch. */
    readonly force?: boolean;
}
