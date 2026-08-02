/* ═══════════════════════════════════════════════════════════════════════════
   Prestige UI — Reactive State Engine, Store & SWR
   TypeScript port of src/prestige-store.js. Preserves the full public API
   (`createStore`, `getStore`, `fetchSWR`, `onCacheChange`) while adding typed
   schemas and deeply frozen snapshots.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { StoreChangeListener, StoreOptions, SWROptions, PrestigeStoreOptions } from '../types/store.js';
import type { StorageKeyProvider } from '../types/desktop.js';

/** Persistence keys matching these terms are refused (credential leak guard). */
const CREDENTIAL_KEY_PATTERN = /token|secret|password|credential|authorization|permission|session|cookie/i;

/** Version prefix for encrypted blobs (`e1:<iv+ct>` base64). */
const ENCRYPTED_BLOB_PREFIX = 'e1:';

/** Property names that can alter or expose an object's prototype chain. */
const UNSAFE_STATE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isUnsafeStateKey(key: PropertyKey): boolean {
    return typeof key === 'string' && UNSAFE_STATE_KEYS.has(key);
}

/** True when an object graph contains a credential-like property name. */
function containsCredentialState(value: unknown, seen = new WeakSet<object>()): boolean {
    if (value === null || typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key === 'string' && CREDENTIAL_KEY_PATTERN.test(key)) return true;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor?.enumerable && 'value' in descriptor && containsCredentialState(descriptor.value, seen)) {
            return true;
        }
    }
    return false;
}

function assertPlaintextSafeState(key: PropertyKey, value: unknown): void {
    if ((typeof key === 'string' && CREDENTIAL_KEY_PATTERN.test(key)) || containsCredentialState(value)) {
        throw new Error('PrestigeStore refuses to persist credential, session, authorization, or permission-like state in localStorage.');
    }
}

/** Copy enumerable own state without invoking prototype setters. */
function copySafeState<T extends object>(...sources: unknown[]): T {
    const result: Record<PropertyKey, unknown> = {};
    for (const source of sources) {
        if (source === null || typeof source !== 'object') continue;
        for (const key of Reflect.ownKeys(source)) {
            if (isUnsafeStateKey(key)) continue;
            const descriptor = Object.getOwnPropertyDescriptor(source, key);
            if (!descriptor?.enumerable) continue;
            Object.defineProperty(result, key, {
                configurable: true,
                enumerable: true,
                value: Reflect.get(source, key),
                writable: true,
            });
        }
    }
    return result as T;
}

function getSchemaValidator(
    schema: StoreOptions['schema'],
    key: PropertyKey,
): ((value: unknown) => boolean) | undefined {
    if (!schema || typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(schema, key)) {
        return undefined;
    }
    return schema[key];
}

function assertValidValue(schema: StoreOptions['schema'], key: PropertyKey, value: unknown): void {
    const validator = getSchemaValidator(schema, key);
    if (validator && !validator(value)) {
        throw new Error(`[PrestigeStore Guard] Invalid value for key "${String(key)}"`);
    }
}

function isValidRestoredValue(schema: StoreOptions['schema'], key: PropertyKey, value: unknown): boolean {
    try {
        assertValidValue(schema, key, value);
        return true;
    } catch (_error) {
        return false;
    }
}

function reportListenerError(kind: 'state' | 'cache', error: unknown): void {
    try {
        console.error(`[PrestigeStore] ${kind} listener error:`, error);
    } catch (_error) { /* Listener isolation must not depend on the console implementation. */ }
}

function notifyStateListeners<T extends object>(
    listeners: Set<StoreChangeListener<T>>,
    key: keyof T,
    value: unknown,
    prev: unknown,
    store: T,
): void {
    listeners.forEach((listener) => {
        try {
            listener(key, value, prev, store);
        } catch (error) {
            reportListenerError('state', error);
        }
    });
}

/** Encode bytes as base64 without hitting the spread argument limit. */
function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)) as number[]);
    }
    return btoa(binary);
}

/** Decode a base64 string into bytes. */
function base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function emitStorageError(key: string, error: unknown): void {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent('storage:error', { detail: { key, error } }));
}

/** Recursively freeze an object graph. Returns the input unchanged. */
function deepFreeze<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value;
    Object.freeze(value);
    const record = value as unknown as Record<string, unknown>;
    for (const key of Object.keys(value)) {
        const nested = record[key];
        if (nested !== null && typeof nested === 'object' && !Object.isFrozen(nested)) {
            deepFreeze(nested);
        }
    }
    return value;
}

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
export class PrestigeStore {
    private readonly _stores = new Map<string, unknown>();
    private readonly _cache = new Map<string, { data: unknown; timestamp: number }>();
    private readonly _cacheListeners = new Map<string, Set<(data: unknown) => void>>();
    private readonly _inflight = new Map<string, Promise<unknown>>();
    private readonly _persistQueues = new Map<string, Promise<void>>();
    private readonly _storage: 'deny-secrets' | 'encrypted';
    private readonly _keyProvider: StorageKeyProvider | null;

    constructor(options: PrestigeStoreOptions = {}) {
        this._storage = options.storage ?? 'deny-secrets';
        this._keyProvider = options.keyProvider ?? null;
    }

    /** True when encrypted persistence is active. */
    private get _isEncrypted(): boolean {
        return this._storage === 'encrypted';
    }

    /** Resolve the app-owned AES-GCM key, throwing when none is available. */
    private async _requireKey(): Promise<CryptoKey> {
        if (!this._keyProvider) {
            throw new Error('PrestigeStore encrypted persistence requires a keyProvider.');
        }
        const key = await this._keyProvider();
        if (!key) throw new Error('PrestigeStore keyProvider returned no key.');
        return key;
    }

    /**
     * Serialize asynchronous persistence writes per key. `_persistEncrypted`
     * is async (key derivation + `crypto.subtle.encrypt`), so firing it
     * unconditionally from the synchronous Proxy `set` trap lets concurrent
     * writes complete out of order and a stale snapshot overwrite a newer one
     * in localStorage. Queueing ensures each write starts only after the
     * previous one finished; because each task stringifies the live `target`
     * when it runs, the final write always carries the newest state.
     */
    private _enqueuePersist(persistedKey: string, task: () => Promise<void>): void {
        const previous = this._persistQueues.get(persistedKey) ?? Promise.resolve();
        const next = previous
            .then(task, task)
            .catch((error: unknown) => { emitStorageError(persistedKey, error); });
        this._persistQueues.set(persistedKey, next);
    }

    /** AES-GCM encrypt `data` and persist it as `e1:<iv+ct>` base64. */
    private async _persistEncrypted(persistedKey: string, state: unknown): Promise<void> {
        const key = await this._requireKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(JSON.stringify(state));
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
        const payload = new Uint8Array(12 + encrypted.byteLength);
        payload.set(iv, 0);
        payload.set(new Uint8Array(encrypted), 12);
        localStorage.setItem(persistedKey, ENCRYPTED_BLOB_PREFIX + bytesToBase64(payload));
    }

    /** Decrypt an `e1:` blob back to JSON text; null for legacy/corrupt data. */
    private async _decryptBlob(blob: string): Promise<string | null> {
        if (!blob.startsWith(ENCRYPTED_BLOB_PREFIX)) return null;
        const key = await this._requireKey();
        const raw = base64ToBytes(blob.slice(ENCRYPTED_BLOB_PREFIX.length));
        const iv = raw.slice(0, 12);
        const data = raw.slice(12);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
        return new TextDecoder().decode(decrypted);
    }

    /**
     * Create a reactive store. Reuses an existing store registered under the
     * same id (later initial state is ignored). When `persistKey` is provided
     * the state is auto-restored from and written to localStorage.
     */
    public createStore<T extends object>(
        storeId: string,
        initialState: T = {} as T,
        options: StoreOptions = {},
    ): PrestigeStoreApi<T> {
        if (!storeId) throw new Error('PrestigeStore.createStore requires a storeId.');
        if (!this._isEncrypted && options.persistKey && CREDENTIAL_KEY_PATTERN.test(options.persistKey)) {
            throw new Error('PrestigeStore refuses to persist credential, session, authorization, or permission-like state in localStorage.');
        }
        const existing = this._stores.get(storeId);
        if (existing) return existing as PrestigeStoreApi<T>;

        const initialData = copySafeState<T>(initialState);
        if (options.persistKey && !this._isEncrypted) assertPlaintextSafeState('', initialData);
        for (const key of Reflect.ownKeys(initialData)) {
            assertValidValue(options.schema, key, Reflect.get(initialData, key));
        }
        let rawData = initialData;
        const persistedKey = options.persistKey ? `prestige_store_${options.persistKey}` : null;
        if (persistedKey && !this._isEncrypted) {
            try {
                const saved = localStorage.getItem(persistedKey);
                if (saved !== null) {
                    const restored: unknown = JSON.parse(saved);
                    if (restored !== null && typeof restored === 'object' && !Array.isArray(restored)) {
                        const validRestored = copySafeState<T>();
                        for (const key of Reflect.ownKeys(restored)) {
                            if (isUnsafeStateKey(key)) continue;
                            const descriptor = Object.getOwnPropertyDescriptor(restored, key);
                            if (!descriptor?.enumerable) continue;
                            const value = Reflect.get(restored, key);
                            try {
                                assertPlaintextSafeState(key, value);
                            } catch (_error) {
                                continue;
                            }
                            if (isValidRestoredValue(options.schema, key, value)) {
                                Object.defineProperty(validRestored, key, {
                                    configurable: true,
                                    enumerable: true,
                                    value,
                                    writable: true,
                                });
                            }
                        }
                        rawData = copySafeState<T>(initialData, validRestored);
                    }
                }
            } catch (_e) { /* corrupt or unavailable storage — fall back to initialState */ }
        }

        // Keys the caller wrote after createStore. Background encrypted
        // restore must never overwrite these — even when the written value
        // happens to equal the initialState value (value-equality alone is
        // not a reliable "untouched" signal).
        const touched = new Set<PropertyKey>();
        const listeners = new Set<StoreChangeListener<T>>();

        const persist = (target: T): void => {
            if (!persistedKey) return;
            if (this._isEncrypted) {
                this._enqueuePersist(persistedKey, () => this._persistEncrypted(persistedKey, target));
            } else {
                try {
                    localStorage.setItem(persistedKey, JSON.stringify(target));
                } catch (error) {
                    emitStorageError(persistedKey, error);
                }
            }
        };

        const assertMutableKey = (prop: PropertyKey): void => {
            if (isUnsafeStateKey(prop)) {
                throw new Error(`[PrestigeStore Guard] Unsafe state key "${String(prop)}"`);
            }
        };

        const handler: ProxyHandler<T> = {
            get: (target, prop, receiver) => {
                if (prop === '$subscribe') {
                    return (fn: StoreChangeListener<T>): (() => void) => {
                        listeners.add(fn);
                        return () => { listeners.delete(fn); };
                    };
                }
                if (prop === '$bindInput') {
                    return (inputEl: HTMLInputElement | HTMLTextAreaElement, stateKey: keyof T): (() => void) => {
                        if (!inputEl || !stateKey) return () => {};
                        inputEl.value = String(target[stateKey] ?? '');
                        const onInput = (e: Event): void => {
                            const input = e.target as HTMLInputElement;
                            proxy[stateKey] = input.value as unknown as T[keyof T];
                        };
                        const onStateChange: StoreChangeListener<T> = (key, val) => {
                            if (key === stateKey && inputEl.value !== val) {
                                inputEl.value = String(val ?? '');
                            }
                        };
                        inputEl.addEventListener('input', onInput);
                        listeners.add(onStateChange);
                        return () => {
                            inputEl.removeEventListener('input', onInput);
                            listeners.delete(onStateChange);
                        };
                    };
                }
                if (prop === '$getRaw') return (): T => ({ ...target });
                if (prop === '$getSnapshot') return (): Readonly<T> => deepFreeze(structuredClone(target) as T);
                return Reflect.get(target, prop, receiver);
            },
            set: (target, prop, value, _receiver) => {
                assertMutableKey(prop);
                if (persistedKey && !this._isEncrypted) {
                    assertPlaintextSafeState(prop, value);
                    assertPlaintextSafeState('', target);
                }
                const key = prop as keyof T;
                assertValidValue(options.schema, prop, value);
                touched.add(prop);
                const prev = Reflect.get(target, prop);
                if (!Object.is(prev, value)) {
                    if (!Reflect.set(target, prop, value)) return false;
                    persist(target);
                    notifyStateListeners(listeners, key, value, prev, proxy);
                }
                return true;
            },
            defineProperty: (target, prop, descriptor) => {
                assertMutableKey(prop);
                if (!Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.get || descriptor.set) {
                    throw new Error('[PrestigeStore Guard] Accessor and attribute-only property definitions are unsupported.');
                }
                if (persistedKey && !this._isEncrypted) {
                    assertPlaintextSafeState(prop, descriptor.value);
                    assertPlaintextSafeState('', target);
                }
                assertValidValue(options.schema, prop, descriptor.value);
                touched.add(prop);
                const existed = Object.prototype.hasOwnProperty.call(target, prop);
                const prev = Reflect.get(target, prop);
                if (!Reflect.defineProperty(target, prop, descriptor)) return false;
                if (!existed || !Object.is(prev, descriptor.value)) {
                    persist(target);
                    notifyStateListeners(listeners, prop as keyof T, descriptor.value, prev, proxy);
                }
                return true;
            },
            deleteProperty: (target, prop) => {
                assertMutableKey(prop);
                touched.add(prop);
                if (!Object.prototype.hasOwnProperty.call(target, prop)) return true;
                assertValidValue(options.schema, prop, undefined);
                const prev = Reflect.get(target, prop);
                if (!Reflect.deleteProperty(target, prop)) return false;
                persist(target);
                notifyStateListeners(listeners, prop as keyof T, undefined, prev, proxy);
                return true;
            },
        };

        const proxy = new Proxy<T>(rawData, handler);
        this._stores.set(storeId, proxy);
        if (persistedKey && this._isEncrypted) {
            this._restoreEncrypted(rawData, persistedKey, listeners, initialData, touched, proxy, options.schema);
        }
        return proxy as PrestigeStoreApi<T>;
    }

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
    private async _restoreEncrypted<T extends object>(
        target: T,
        persistedKey: string,
        listeners: Set<StoreChangeListener<T>>,
        initialState: T,
        touched: Set<PropertyKey>,
        proxy: T,
        schema: StoreOptions['schema'],
    ): Promise<void> {
        try {
            const saved = localStorage.getItem(persistedKey);
            if (saved === null) return;
            const json = await this._decryptBlob(saved);
            if (json === null) return;
            const restored: unknown = JSON.parse(json);
            if (restored === null || typeof restored !== 'object' || Array.isArray(restored)) return;
            const safeRestored = copySafeState<T>(restored);
            for (const key of Reflect.ownKeys(safeRestored)) {
                const k = key as keyof T;
                if (touched.has(k)) continue;
                const value = Reflect.get(safeRestored, key);
                if (!isValidRestoredValue(schema, key, value)) continue;
                if (!Object.is(Reflect.get(target, key), Reflect.get(initialState, key))) continue;
                const prev = Reflect.get(target, key);
                if (!Object.is(prev, value)) {
                    Reflect.set(target, key, value);
                    notifyStateListeners(listeners, k, value, prev, proxy);
                }
            }
        } catch (error) {
            emitStorageError(persistedKey, error);
        }
    }

    /** Retrieve a previously created store, or null. */
    public getStore<T extends object>(storeId: string): PrestigeStoreApi<T> | null {
        const existing = this._stores.get(storeId);
        return existing ? (existing as PrestigeStoreApi<T>) : null;
    }

    /**
     * Stale-While-Revalidate server cache. Fresh entries within `ttl` are
     * served immediately; stale entries are served while revalidating in the
     * background; concurrent requests for the same key are deduplicated.
     */
    public async fetchSWR<D>(key: string, fetcher: () => Promise<D>, options: SWROptions = {}): Promise<D> {
        const ttl = options.ttl ?? 60000;
        const cached = this._cache.get(key);
        const now = Date.now();

        if (cached && now - cached.timestamp < ttl && !options.force) {
            return cached.data as D;
        }
        if (cached && options.staleWhileRevalidate && !options.force) {
            this._executeFetcher(key, fetcher).catch(() => {});
            return cached.data as D;
        }
        return await this._executeFetcher(key, fetcher);
    }

    /** Run (or join) a fetcher, caching the result and notifying cache listeners. */
    private async _executeFetcher<D>(key: string, fetcher: () => Promise<D>): Promise<D> {
        const inFlight = this._inflight.get(key);
        if (inFlight) return inFlight as Promise<D>;

        const request = Promise.resolve()
            .then(fetcher)
            .then((data) => {
                this._cache.set(key, { data, timestamp: Date.now() });
                const listeners = this._cacheListeners.get(key);
                if (listeners) {
                    listeners.forEach((listener) => {
                        try {
                            listener(data);
                        } catch (error) {
                            reportListenerError('cache', error);
                        }
                    });
                }
                return data;
            })
            .catch((error: unknown) => {
                console.error(`[PrestigeStore] SWR Fetch Error on key "${key}":`, error);
                throw error;
            })
            .finally(() => { this._inflight.delete(key); });

        this._inflight.set(key, request);
        return request;
    }

    /** Subscribe to cache revalidations for a key; returns an unsubscribe function. */
    public onCacheChange(key: string, callback: (data: unknown) => void): () => void {
        const existing = this._cacheListeners.get(key);
        if (existing) {
            existing.add(callback);
        } else {
            const listeners = new Set<(data: unknown) => void>();
            listeners.add(callback);
            this._cacheListeners.set(key, listeners);
        }
        return () => {
            const listeners = this._cacheListeners.get(key);
            if (!listeners) return;
            listeners.delete(callback);
            if (listeners.size === 0) this._cacheListeners.delete(key);
        };
    }
}
