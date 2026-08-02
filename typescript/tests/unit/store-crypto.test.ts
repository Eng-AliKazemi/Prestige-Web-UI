/**
 * Encrypted store persistence verification: deny-by-default credential guard,
 * app-keyed AES-GCM round-trip, wrong-key fallback, and legacy-blob rejection.
 * Uses a reversible fake `crypto.subtle` (happy-dom lacks a WebCrypto impl).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrestigeStore } from '../../src/core/Store.js';
import { installMemoryStorage } from '../helpers/memoryStorage.js';

interface FakeSubtle {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
}

const KEY_A = { kind: 'a' } as unknown as CryptoKey;
const KEY_B = { kind: 'b' } as unknown as CryptoKey;

function installFakeCrypto(failKey?: object): FakeSubtle {
    const subtle: FakeSubtle = {
        encrypt: vi.fn(async (_alg: unknown, _key: unknown, data: ArrayBuffer): Promise<ArrayBuffer> => data),
        decrypt: vi.fn(async (_alg: unknown, key: object, data: ArrayBuffer): Promise<ArrayBuffer> => {
            if (failKey && key === failKey) throw new Error('Authentication error');
            return data;
        }),
    };
    vi.stubGlobal('crypto', {
        getRandomValues: (arr: Uint8Array): Uint8Array => {
            for (let i = 0; i < arr.length; i++) arr[i] = (i * 7) % 256;
            return arr;
        },
        subtle,
    });
    return subtle;
}

async function flushAsync(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('PrestigeStore encrypted persistence', () => {
    it('denies credential-like persist keys by default', () => {
        installMemoryStorage();
        const store = new PrestigeStore();
        expect(() => store.createStore('s', { a: 1 }, { persistKey: 'user_token' }))
            .toThrow(/credential/);
    });

    it('allows sensitive keys when encryption is opted in', () => {
        installMemoryStorage();
        installFakeCrypto();
        const store = new PrestigeStore({
            storage: 'encrypted',
            keyProvider: async () => KEY_A,
        });
        expect(() => store.createStore('s', { a: 1 }, { persistKey: 'user_token' }))
            .not.toThrow();
    });

    it('round-trips state across store instances', async () => {
        const storage = installMemoryStorage();
        installFakeCrypto();

        const store1 = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_A });
        const proxy1 = store1.createStore('x', { a: 1 }, { persistKey: 'data' });
        proxy1.a = 2;
        await flushAsync();

        const blob = storage.getItem('prestige_store_data');
        expect(blob).not.toBeNull();
        expect(blob?.startsWith('e1:')).toBe(true);

        const store2 = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_A });
        const proxy2 = store2.createStore('x', { a: 99 }, { persistKey: 'data' });
        expect(proxy2.a).toBe(99);
        await flushAsync();
        expect(proxy2.a).toBe(2);
    });

    it('falls back to initialState and emits storage:error on a wrong key', async () => {
        installMemoryStorage();
        installFakeCrypto(KEY_B);

        const store1 = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_A });
        const proxy1 = store1.createStore('x', { a: 1 }, { persistKey: 'data' });
        proxy1.a = 2;
        await flushAsync();

        const errorEvent = vi.fn();
        window.addEventListener('storage:error', errorEvent);
        const store2 = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_B });
        const proxy2 = store2.createStore('x', { a: 99 }, { persistKey: 'data' });
        await flushAsync();

        expect(proxy2.a).toBe(99);
        expect(errorEvent).toHaveBeenCalled();
        window.removeEventListener('storage:error', errorEvent);
    });

    it('rejects legacy plaintext blobs in encrypted mode without error', async () => {
        installMemoryStorage();
        installFakeCrypto();
        localStorage.setItem('prestige_store_data', '{"a":7}');

        const store = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_A });
        const proxy = store.createStore('x', { a: 99 }, { persistKey: 'data' });
        await flushAsync();
        expect(proxy.a).toBe(99);
    });

    it('never clobbers user writes made before the restore completes', async () => {
        installMemoryStorage();
        installFakeCrypto();

        const store1 = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_A });
        const proxy1 = store1.createStore('x', { a: 1 }, { persistKey: 'data' });
        proxy1.a = 2;
        await flushAsync();

        const store2 = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_A });
        const proxy2 = store2.createStore('x', { a: 99 }, { persistKey: 'data' });
        proxy2.a = 5;
        await flushAsync();
        expect(proxy2.a).toBe(5);
    });

    it('validates restored values and drops prototype-sensitive keys', async () => {
        installMemoryStorage();
        installFakeCrypto();

        const source = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_A });
        const sourceProxy = source.createStore(
            'source',
            { count: 1 as number | string, label: 'initial' },
            { persistKey: 'data' },
        );
        sourceProxy.count = 'invalid';
        sourceProxy.label = 'restored';
        await flushAsync();

        const blob = localStorage.getItem('prestige_store_data');
        expect(blob).not.toBeNull();
        const decoded = atob((blob as string).slice('e1:'.length));
        const persisted = JSON.parse(decoded.slice(12)) as Record<string, unknown>;
        Object.defineProperty(persisted, '__proto__', {
            enumerable: true,
            value: { polluted: true },
        });
        Object.defineProperty(persisted, 'constructor', {
            enumerable: true,
            value: { prototype: { polluted: true } },
        });
        const payload = new Uint8Array(12 + new TextEncoder().encode(JSON.stringify(persisted)).length);
        payload.set(new TextEncoder().encode(JSON.stringify(persisted)), 12);
        localStorage.setItem('prestige_store_data', `e1:${btoa(String.fromCharCode(...payload))}`);

        const target = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_A });
        const restored = target.createStore('target', { count: 7, label: 'initial' }, {
            persistKey: 'data',
            schema: { count: (val) => typeof val === 'number' },
        });
        await flushAsync();

        expect(restored).toEqual(expect.objectContaining({ count: 7, label: 'restored' }));
        expect(Object.getPrototypeOf(restored)).toBe(Object.prototype);
        expect(Object.prototype.hasOwnProperty.call(restored, '__proto__')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(restored, 'constructor')).toBe(false);
        expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    });

    it('serializes encrypted writes so a stale snapshot cannot overwrite newer state', async () => {
        const storage = installMemoryStorage();
        const gate: Array<() => void> = [];
        const subtle = {
            encrypt: vi.fn(async (_alg: unknown, _key: unknown, data: ArrayBuffer): Promise<ArrayBuffer> => {
                await new Promise<void>((resolve) => gate.push(resolve));
                return data;
            }),
            decrypt: vi.fn(async (): Promise<ArrayBuffer> => { throw new Error('unused'); }),
        };
        vi.stubGlobal('crypto', {
            getRandomValues: (arr: Uint8Array): Uint8Array => {
                for (let i = 0; i < arr.length; i++) arr[i] = (i * 7) % 256;
                return arr;
            },
            subtle,
        });

        const store = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_A });
        const proxy = store.createStore('x', { a: 1 }, { persistKey: 'data' });

        proxy.a = 2;                       // write 1 enqueued
        await flushAsync();
        expect(subtle.encrypt).toHaveBeenCalledTimes(1);

        proxy.a = 3;                       // write 2 enqueued behind write 1
        await flushAsync();
        // With the fix, write 2 must not have started while write 1 is in flight.
        expect(subtle.encrypt).toHaveBeenCalledTimes(1);

        gate[0]();                         // release write 1
        await flushAsync();
        expect(subtle.encrypt).toHaveBeenCalledTimes(2);

        gate[1]();                         // release write 2
        await flushAsync();

        const blob = storage.getItem('prestige_store_data');
        expect(blob).not.toBeNull();
        const decoded = atob((blob as string).slice('e1:'.length));
        const persisted = JSON.parse(decoded.slice(12)); // skip the 12-byte IV
        expect(persisted).toEqual({ a: 3 });
    });
});
