import type { StoreChangeListener, StoreOptions, SWROptions, PrestigeStoreOptions } from '../types/store.js';
/**
 * Reactive store handle: the state shape `T` extended with the store's
 * control methods (`$subscribe`, `$bindInput`, `$getRaw`, `$getSnapshot`).
 */
export type PrestigeStoreApi<T> = T & {
    /** Subscribe to state changes; returns an unsubscribe function. */
    $subscribe(listener: StoreChangeListener<T>): () => void;
    /** Two-way bind an input element to a state key; returns an unbind function. */
    $bindInput(inputEl: HTMLInputElement | HTMLTextAreaElement, stateKey: keyof T): () => void;
    /** Mutable shallow copy of the current state. */
    $getRaw(): T;
    /** Deeply frozen structured clone of the current state. */
    $getSnapshot(): Readonly<T>;
};
/**
 * Reactive Proxy-based state store with SWR server caching, credential
 * persistence guards, optional per-key schema validation, and deep-frozen
 * snapshot reads.
 */
export declare class PrestigeStore {
    private readonly _stores;
    private readonly _cache;
    private readonly _cacheListeners;
    private readonly _inflight;
    private readonly _persistQueues;
    private readonly _storage;
    private readonly _keyProvider;
    constructor(options?: PrestigeStoreOptions);
    /** True when encrypted persistence is active. */
    private get _isEncrypted();
    /** Resolve the app-owned AES-GCM key, throwing when none is available. */
    private _requireKey;
    /**
     * Serialize asynchronous persistence writes per key. `_persistEncrypted`
     * is async (key derivation + `crypto.subtle.encrypt`), so firing it
     * unconditionally from the synchronous Proxy `set` trap lets concurrent
     * writes complete out of order and a stale snapshot overwrite a newer one
     * in localStorage. Queueing ensures each write starts only after the
     * previous one finished; because each task stringifies the live `target`
     * when it runs, the final write always carries the newest state.
     */
    private _enqueuePersist;
    /** AES-GCM encrypt `data` and persist it as `e1:<iv+ct>` base64. */
    private _persistEncrypted;
    /** Decrypt an `e1:` blob back to JSON text; null for legacy/corrupt data. */
    private _decryptBlob;
    /**
     * Create a reactive store. Reuses an existing store registered under the
     * same id (later initial state is ignored). When `persistKey` is provided
     * the state is auto-restored from and written to localStorage.
     */
    createStore<T extends object>(storeId: string, initialState?: T, options?: StoreOptions): PrestigeStoreApi<T>;
    /**
     * Background decryption-and-merge for `'encrypted'` persistence. Runs
     * asynchronously so `createStore` stays synchronous; on decrypt failure or
     * corrupt/legacy blobs the store falls back to `initialState` and emits a
     * `storage:error` event (never throws).
     *
     * A restored value is applied ONLY to keys the caller has not written
     * since `createStore` (tracked by the `touched` set), so caller writes are
     * never clobbered by stale persisted data — even when a written value
     * equals the `initialState` value.
     */
    private _restoreEncrypted;
    /** Retrieve a previously created store, or null. */
    getStore<T extends object>(storeId: string): PrestigeStoreApi<T> | null;
    /**
     * Stale-While-Revalidate server cache. Fresh entries within `ttl` are
     * served immediately; stale entries are served while revalidating in the
     * background; concurrent requests for the same key are deduplicated.
     */
    fetchSWR<D>(key: string, fetcher: () => Promise<D>, options?: SWROptions): Promise<D>;
    /** Run (or join) a fetcher, caching the result and notifying cache listeners. */
    private _executeFetcher;
    /** Subscribe to cache revalidations for a key; returns an unsubscribe function. */
    onCacheChange(key: string, callback: (data: unknown) => void): () => void;
}
//# sourceMappingURL=Store.d.ts.map