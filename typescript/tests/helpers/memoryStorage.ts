/**
 * Test helper: install an in-memory Storage on globalThis. happy-dom's Node
 * localStorage stub lacks working methods (`clear is not a function`), so the
 * store/persistence tests use this deterministic implementation instead.
 */
export function installMemoryStorage(): Storage {
    const data = new Map<string, string>();
    const storage: Storage = {
        get length(): number { return data.size; },
        clear(): void { data.clear(); },
        getItem(key: string): string | null { return data.get(key) ?? null; },
        key(index: number): string | null { return Array.from(data.keys())[index] ?? null; },
        removeItem(key: string): void { data.delete(key); },
        setItem(key: string, value: string): void { data.set(key, String(value)); },
    };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    return storage;
}
