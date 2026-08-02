/**
 * Phase 3 verification: reactive store subscription, credential guard,
 * deep-frozen snapshots, and SWR deduplication / stale-while-revalidate.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrestigeStore } from '../../src/core/Store.js';
import { installMemoryStorage } from '../helpers/memoryStorage.js';

beforeEach(() => {
    installMemoryStorage();
});

describe('PrestigeStore.createStore', () => {
    it('notifies $subscribe listeners on state changes with (prop, value, prev, target)', () => {
        const store = new PrestigeStore();
        const api = store.createStore('user', { name: 'Alice', theme: 'dark' });
        const listener = vi.fn();
        const unsubscribe = api.$subscribe(listener);

        api.theme = 'light';
        expect(listener).toHaveBeenCalledWith('theme', 'light', 'dark', expect.objectContaining({ theme: 'light' }));

        unsubscribe();
        api.theme = 'dark';
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not notify when the assigned value is unchanged', () => {
        const store = new PrestigeStore();
        const api = store.createStore('x', { n: 1 });
        const listener = vi.fn();
        api.$subscribe(listener);
        api.n = 1;
        expect(listener).not.toHaveBeenCalled();
        api.n = 2;
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('reuses the existing store instance for a duplicate id', () => {
        const store = new PrestigeStore();
        const a = store.createStore('s', { v: 1 });
        const b = store.createStore('s', { v: 9 });
        expect(b).toBe(a);
        expect(b.v).toBe(1);
        expect(store.getStore('s')).toBe(a);
        expect(store.getStore('missing')).toBeNull();
    });

    it('rejects credential-like persistKey values', () => {
        const store = new PrestigeStore();
        expect(() => store.createStore('creds', { t: 'x' }, { persistKey: 'auth_token' })).toThrow(/credential/);
        expect(() => store.createStore('creds', { t: 'x' }, { persistKey: 'user_session' })).toThrow(/credential/);
        expect(() => store.createStore('ok', { t: 'x' }, { persistKey: 'app_prefs' })).not.toThrow();
    });

    it('rejects credential-like plaintext state even under a safe persistKey', () => {
        const store = new PrestigeStore();
        expect(() => store.createStore('direct', { token: 'secret' }, { persistKey: 'prefs' })).toThrow(/credential/);
        expect(() => store.createStore('nested', { profile: { password: 'secret' } }, { persistKey: 'prefs' })).toThrow(/credential/);

        const api = store.createStore('safe', { profile: { name: 'Ada' }, theme: 'dark' }, { persistKey: 'prefs' });
        expect(() => { api.profile = { name: 'Ada', authorization: 'Bearer secret' } as typeof api.profile; }).toThrow(/credential/);
        expect(() => Object.defineProperty(api, 'session', { value: 'secret' })).toThrow(/credential/);
        expect(localStorage.getItem('prestige_store_prefs')).toBeNull();
    });

    it('does not restore credential-like fields from plaintext persistence', () => {
        localStorage.setItem('prestige_store_prefs', JSON.stringify({
            theme: 'light',
            auth: { token: 'secret' },
            cookie: 'secret',
        }));
        const api = new PrestigeStore().createStore(
            'restored-safe',
            { theme: 'dark', auth: { name: 'anonymous' } },
            { persistKey: 'prefs' },
        );
        expect(api).toEqual(expect.objectContaining({
            theme: 'light',
            auth: { name: 'anonymous' },
        }));
        expect((api as typeof api & { cookie?: string }).cookie).toBeUndefined();
    });

    it('persists to localStorage under a safe persistKey and restores on reload', () => {
        const store = new PrestigeStore();
        const api = store.createStore('prefs', { volume: 50 }, { persistKey: 'app_prefs' });
        api.volume = 80;
        const saved = JSON.parse(localStorage.getItem('prestige_store_app_prefs') ?? '{}');
        expect(saved.volume).toBe(80);

        const store2 = new PrestigeStore();
        const restored = store2.createStore('prefs', { volume: 0 }, { persistKey: 'app_prefs' });
        expect(restored.volume).toBe(80);
    });

    it('enforces schema validators on writes', () => {
        const store = new PrestigeStore();
        const api = store.createStore('guarded', { count: 0 }, {
            schema: { count: (val) => typeof val === 'number' && val >= 0 },
        });
        expect(() => { api.count = -5; }).toThrow(/Invalid value for key "count"/);
        api.count = 5;
        expect(api.count).toBe(5);
    });

    it('validates initial state and ignores invalid persisted values', () => {
        const schema = { count: (val: unknown) => typeof val === 'number' && val >= 0 };
        const store = new PrestigeStore();
        expect(() => store.createStore('invalid', { count: -1 }, { schema }))
            .toThrow(/Invalid value for key "count"/);

        localStorage.setItem('prestige_store_validated', JSON.stringify({ count: -5, label: 'restored' }));
        const restored = store.createStore('restored', { count: 2, label: 'initial' }, {
            persistKey: 'validated',
            schema,
        });
        expect(restored).toEqual(expect.objectContaining({ count: 2, label: 'restored' }));
    });

    it('drops prototype-sensitive keys from initial and persisted state', () => {
        const initial = JSON.parse(
            '{"safe":1,"__proto__":{"polluted":"initial"},"constructor":{"prototype":{"polluted":"initial"}}}',
        ) as { safe: number };
        localStorage.setItem(
            'prestige_store_pollution',
            '{"safe":2,"__proto__":{"polluted":"persisted"},"constructor":{"prototype":{"polluted":"persisted"}}}',
        );

        const api = new PrestigeStore().createStore('pollution', initial, { persistKey: 'pollution' });
        expect(api.safe).toBe(2);
        expect(Object.getPrototypeOf(api)).toBe(Object.prototype);
        expect(Object.prototype.hasOwnProperty.call(api, '__proto__')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(api, 'constructor')).toBe(false);
        expect(({} as { polluted?: string }).polluted).toBeUndefined();

        expect(() => Reflect.set(api, '__proto__', { polluted: true })).toThrow(/Unsafe state key/);
        expect(() => Object.defineProperty(api, 'constructor', { value: {} })).toThrow(/Unsafe state key/);
    });

    it('routes defineProperty and delete through validation, persistence, and subscriptions', () => {
        const store = new PrestigeStore();
        const initial: { count: number; removable?: string } = { count: 1, removable: 'yes' };
        const api = store.createStore('descriptors', initial, {
            persistKey: 'descriptors',
            schema: {
                count: (val) => typeof val === 'number' && val >= 0,
                removable: (val) => val === undefined || typeof val === 'string',
            },
        });
        const listener = vi.fn();
        api.$subscribe(listener);

        expect(() => Object.defineProperty(api, 'count', { value: -1 })).toThrow(/Invalid value/);
        expect(api.count).toBe(1);
        Object.defineProperty(api, 'count', {
            configurable: true,
            enumerable: true,
            value: 3,
            writable: true,
        });
        expect(api.count).toBe(3);
        expect(listener).toHaveBeenCalledWith('count', 3, 1, api);
        expect(() => Reflect.deleteProperty(api, 'count')).toThrow(/Invalid value/);
        expect(api.count).toBe(3);

        expect(delete api.removable).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(api, 'removable')).toBe(false);
        expect(listener).toHaveBeenCalledWith('removable', undefined, 'yes', api);
        expect(JSON.parse(localStorage.getItem('prestige_store_descriptors') ?? '{}')).toEqual({ count: 3 });
        expect(() => Object.defineProperty(api, 'derived', { get: () => 1 })).toThrow(/unsupported/);
    });

    it('passes the store proxy to subscribers and isolates listener exceptions', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const store = new PrestigeStore();
        const api = store.createStore('listeners', { count: 0 });
        const throwing = vi.fn(() => { throw new Error('listener failed'); });
        const later = vi.fn();
        api.$subscribe(throwing);
        api.$subscribe(later);

        expect(() => { api.count = 1; }).not.toThrow();
        expect(api.count).toBe(1);
        expect(later).toHaveBeenCalledWith('count', 1, 0, api);
        expect(consoleError).toHaveBeenCalledWith(
            '[PrestigeStore] state listener error:',
            expect.objectContaining({ message: 'listener failed' }),
        );
        consoleError.mockRestore();
    });
});

describe('PrestigeStore snapshots', () => {
    it('$getSnapshot returns a deeply frozen structured clone', () => {
        const store = new PrestigeStore();
        const api = store.createStore('nested', { profile: { name: 'Ada', tags: ['a', 'b'] } });

        const snap = api.$getSnapshot();
        expect(Object.isFrozen(snap)).toBe(true);
        expect(Object.isFrozen(snap.profile)).toBe(true);
        expect(Object.isFrozen(snap.profile.tags)).toBe(true);

        expect(() => { snap.profile.name = 'changed'; }).toThrow(TypeError);

        api.profile.name = 'Grace';
        expect(snap.profile.name).toBe('Ada');
    });

    it('$getRaw returns a mutable shallow copy', () => {
        const store = new PrestigeStore();
        const api = store.createStore('m', { v: 1 });
        const raw = api.$getRaw();
        expect(raw.v).toBe(1);
        raw.v = 99;
        expect(api.v).toBe(1);
    });
});

describe('PrestigeStore.$bindInput', () => {
    it('two-way binds an input element to a state key', () => {
        const store = new PrestigeStore();
        const api = store.createStore('form', { name: 'Ada' });
        const input = document.createElement('input');
        const unbind = api.$bindInput(input, 'name');

        expect(input.value).toBe('Ada');
        input.value = 'Grace';
        input.dispatchEvent(new Event('input'));
        expect(api.name).toBe('Grace');

        api.name = 'Lin';
        expect(input.value).toBe('Lin');

        unbind();
        api.name = 'Eve';
        expect(input.value).toBe('Lin');
    });
});

describe('PrestigeStore.fetchSWR', () => {
    it('deduplicates concurrent in-flight requests for the same key', async () => {
        const store = new PrestigeStore();
        let calls = 0;
        const fetcher = () => new Promise<string>((resolve) => {
            calls += 1;
            setTimeout(() => resolve('data'), 30);
        });

        const [a, b] = await Promise.all([
            store.fetchSWR('key1', fetcher),
            store.fetchSWR('key1', fetcher),
        ]);
        expect(a).toBe('data');
        expect(b).toBe('data');
        expect(calls).toBe(1);
    });

    it('serves fresh cache within the TTL without refetching', async () => {
        const store = new PrestigeStore();
        let calls = 0;
        const fetcher = async () => { calls += 1; return 'v1'; };
        await store.fetchSWR('k', fetcher);
        await store.fetchSWR('k', fetcher, { ttl: 60000 });
        expect(calls).toBe(1);
    });

    it('serves stale data immediately while revalidating in the background', async () => {
        const store = new PrestigeStore();
        let calls = 0;
        const fetcher = async () => { calls += 1; return `v${calls}`; };
        await store.fetchSWR('k', fetcher, { ttl: 0 });

        const stale = await store.fetchSWR('k', fetcher, { staleWhileRevalidate: true, ttl: 0 });
        expect(stale).toBe('v1');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(calls).toBe(2);
    });

    it('forces a refetch when force is true', async () => {
        const store = new PrestigeStore();
        let calls = 0;
        const fetcher = async () => { calls += 1; return `v${calls}`; };
        await store.fetchSWR('k', fetcher);
        const forced = await store.fetchSWR('k', fetcher, { force: true });
        expect(forced).toBe('v2');
        expect(calls).toBe(2);
    });

    it('notifies onCacheChange subscribers with fresh data', async () => {
        const store = new PrestigeStore();
        const listener = vi.fn();
        store.onCacheChange('k', listener);
        await store.fetchSWR('k', async () => 'fresh');
        expect(listener).toHaveBeenCalledWith('fresh');
    });

    it('isolates cache listener exceptions and continues notifying subscribers', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const store = new PrestigeStore();
        const throwing = vi.fn(() => { throw new Error('cache listener failed'); });
        const later = vi.fn();
        store.onCacheChange('k', throwing);
        store.onCacheChange('k', later);

        await expect(store.fetchSWR('k', async () => 'fresh')).resolves.toBe('fresh');
        expect(later).toHaveBeenCalledWith('fresh');
        expect(consoleError).toHaveBeenCalledWith(
            '[PrestigeStore] cache listener error:',
            expect.objectContaining({ message: 'cache listener failed' }),
        );
        consoleError.mockRestore();
    });

    it('removes empty cache listener sets on unsubscribe', () => {
        const store = new PrestigeStore();
        const unsubscribeA = store.onCacheChange('k', vi.fn());
        const unsubscribeB = store.onCacheChange('k', vi.fn());
        const listeners = (store as unknown as {
            _cacheListeners: Map<string, Set<(data: unknown) => void>>;
        })._cacheListeners;

        unsubscribeA();
        expect(listeners.has('k')).toBe(true);
        unsubscribeB();
        expect(listeners.has('k')).toBe(false);
        expect(() => unsubscribeB()).not.toThrow();
    });

    it('rejects and does not cache a failed fetch', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const store = new PrestigeStore();
        const err = new Error('boom');
        await expect(store.fetchSWR('k', async () => { throw err; })).rejects.toThrow('boom');
        const retry = await store.fetchSWR('k', async () => 'ok');
        expect(retry).toBe('ok');
        expect(consoleError).toHaveBeenCalledWith('[PrestigeStore] SWR Fetch Error on key "k":', err);
        consoleError.mockRestore();
    });
});
