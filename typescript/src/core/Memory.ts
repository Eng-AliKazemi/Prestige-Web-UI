/* ═══════════════════════════════════════════════════════════════════════════
   Prestige UI — Memory Engine
   TypeScript port of src/memory.js implementing TC39 Native Explicit Resource
   Management (Symbol.dispose / Disposable protocol): DisposalStack & Owned.
   ═══════════════════════════════════════════════════════════════════════════ */

/*
 * Runtime fallback: environments without a native Symbol.dispose fall back to
 * the well-known Symbol.for('dispose') key so pre-standard Disposables keep
 * interoperating. Native browsers are untouched (typeof check short-circuits).
 */
if (typeof Symbol.dispose !== 'symbol') {
    Object.defineProperty(Symbol, 'dispose', {
        value: Symbol.for('dispose'),
        writable: true,
        configurable: true,
    });
}

const DISPOSE_SYMBOL: typeof Symbol.dispose = Symbol.dispose;

/**
 * Deterministic LIFO resource stack. Register timers, listeners, sockets, and
 * subscriptions; a single `dispose()` (or `using`) tears them all down.
 */
export class DisposalStack implements Disposable {
    private cleanups: Array<() => void> = [];
    private disposed = false;
    private ownedLeaks = 0;

    constructor(public readonly name: string = '') {}

    /** True after this stack has begun disposal. */
    public get isDisposed(): boolean {
        return this.disposed;
    }

    private assertActive(): void {
        if (this.disposed) {
            throw new Error(`Cannot register a resource on disposed DisposalStack${this.name ? ` "${this.name}"` : ''}.`);
        }
    }

    /** Queue a cleanup callback executed on disposal (LIFO order). */
    public defer(fn: () => void): void {
        this.assertActive();
        if (typeof fn === 'function') this.cleanups.push(fn);
    }

    /** Bind an event listener and automatically remove it on disposal. */
    public listen(
        target: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ): void {
        if (!target || typeof target.addEventListener !== 'function') return;
        this.assertActive();
        target.addEventListener(type, listener, options);
        this.defer(() => target.removeEventListener(type, listener, options));
    }

    /** Create a timeout and clear it on disposal. */
    public setTimeout(fn: () => void, delay: number): number {
        this.assertActive();
        const id = window.setTimeout(fn, delay);
        this.defer(() => window.clearTimeout(id));
        return id;
    }

    /** Create an interval and clear it on disposal. */
    public setInterval(fn: () => void, delay: number): number {
        this.assertActive();
        const id = window.setInterval(fn, delay);
        this.defer(() => window.clearInterval(id));
        return id;
    }

    /** Track a WebSocket and close it safely on disposal. */
    public manageSocket(socket: WebSocket): void {
        if (!socket) return;
        this.defer(() => {
            if (typeof socket.close === 'function' && socket.readyState < WebSocket.CLOSING) {
                try { socket.close(); } catch (_e) { /* already closing or closed */ }
            }
        });
    }

    /** Register an unsubscribe callback (e.g. a store subscription). */
    public subscribe(unsubscribe: () => void): void {
        if (typeof unsubscribe === 'function') this.defer(unsubscribe);
    }

    /**
     * Take ownership of a Disposable. On stack disposal the resource is
     * disposed; Owned-like resources still alive at that point are audited and
     * reported as leaks (use `.move()` to transfer ownership first).
     */
    public own<T extends Disposable>(resource: T): T {
        if (!resource) return resource;
        if (this.disposed) {
            const disposer = resource[DISPOSE_SYMBOL];
            if (typeof disposer === 'function') disposer.call(resource);
            return resource;
        }
        this.defer(() => {
            const tracked = resource as T & { isAlive?: () => boolean };
            if (typeof tracked.isAlive === 'function' && tracked.isAlive()) {
                this.ownedLeaks++;
            }
            const disposer = resource[DISPOSE_SYMBOL];
            if (typeof disposer === 'function') disposer.call(resource);
        });
        return resource;
    }

    /**
     * Track a byte buffer holding secrets. On disposal the bytes are zeroed
     * (`ArrayBuffer` is wrapped in a `Uint8Array` view to fill).
     */
    public ownSecret(buffer: Uint8Array | ArrayBuffer): Uint8Array | ArrayBuffer {
        this.defer(() => {
            if (buffer instanceof ArrayBuffer) {
                new Uint8Array(buffer).fill(0);
            } else if (buffer instanceof Uint8Array) {
                buffer.fill(0);
            }
        });
        return buffer;
    }

    /** Native disposal protocol entry point. */
    public [DISPOSE_SYMBOL](): void {
        this.dispose();
    }

    /** Execute all queued cleanups in LIFO order. Idempotent. */
    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        while (this.cleanups.length > 0) {
            const cleanup = this.cleanups.pop();
            try { cleanup?.(); } catch (e) { console.error(`[DisposalStack${this.name ? ' ' + this.name : ''}]`, e); }
        }
        if (this.ownedLeaks > 0) {
            console.warn(`[DisposalStack${this.name ? ' ' + this.name : ''}] ` +
                `${this.ownedLeaks} Owned resource(s) were still alive when disposed. ` +
                'Use .move() to transfer ownership before closing.');
            this.ownedLeaks = 0;
        }
    }
}

/**
 * Affine single-ownership wrapper: the underlying resource has exactly one
 * owner at any time. `.move()` transfers ownership (invalidating the source),
 * `.use()` borrows it, and `.dispose()` releases it exactly once.
 */
export class Owned<T> implements Disposable {
    private _value: T | null;
    private _disposer: ((val: T) => void) | null;
    private _alive = true;

    constructor(resource: T, disposer: (val: T) => void) {
        this._value = resource;
        this._disposer = disposer;
    }

    /** Borrow the inner resource. Throws if already moved or disposed. */
    public use<R>(fn: (resource: T) => R): R {
        if (!this._alive || this._value === null) {
            throw new Error('Owned resource has already been moved or disposed — use-after-move detected');
        }
        return fn(this._value);
    }

    /** Transfer ownership to a new handle; the current one is invalidated. */
    public move(): Owned<T> {
        const value = this._value;
        const disposer = this._disposer;
        if (!this._alive || value === null || disposer === null) {
            throw new Error('Owned resource has already been moved — double-move detected');
        }
        this._alive = false;
        this._value = null;
        this._disposer = null;
        return new Owned<T>(value, disposer);
    }

    /** Native disposal protocol entry point. */
    public [DISPOSE_SYMBOL](): void {
        this.dispose();
    }

    /** Invoke the disposer exactly once and mark the handle as dead. */
    public dispose(): void {
        const value = this._value;
        const disposer = this._disposer;
        if (!this._alive || value === null || disposer === null) return;
        this._alive = false;
        this._value = null;
        this._disposer = null;
        disposer(value);
    }

    /** True while the resource has not been moved or disposed. */
    public isAlive(): boolean {
        return this._alive;
    }
}
