declare const DISPOSE_SYMBOL: typeof Symbol.dispose;
/**
 * Deterministic LIFO resource stack. Register timers, listeners, sockets, and
 * subscriptions; a single `dispose()` (or `using`) tears them all down.
 */
export declare class DisposalStack implements Disposable {
    readonly name: string;
    private cleanups;
    private disposed;
    private ownedLeaks;
    constructor(name?: string);
    /** True after this stack has begun disposal. */
    get isDisposed(): boolean;
    private assertActive;
    /** Queue a cleanup callback executed on disposal (LIFO order). */
    defer(fn: () => void): void;
    /** Bind an event listener and automatically remove it on disposal. */
    listen(target: EventTarget, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    /** Create a timeout and clear it on disposal. */
    setTimeout(fn: () => void, delay: number): number;
    /** Create an interval and clear it on disposal. */
    setInterval(fn: () => void, delay: number): number;
    /** Track a WebSocket and close it safely on disposal. */
    manageSocket(socket: WebSocket): void;
    /** Register an unsubscribe callback (e.g. a store subscription). */
    subscribe(unsubscribe: () => void): void;
    /**
     * Take ownership of a Disposable. On stack disposal the resource is
     * disposed; Owned-like resources still alive at that point are audited and
     * reported as leaks (use `.move()` to transfer ownership first).
     */
    own<T extends Disposable>(resource: T): T;
    /**
     * Track a byte buffer holding secrets. On disposal the bytes are zeroed
     * (`ArrayBuffer` is wrapped in a `Uint8Array` view to fill).
     */
    ownSecret(buffer: Uint8Array | ArrayBuffer): Uint8Array | ArrayBuffer;
    /** Native disposal protocol entry point. */
    [DISPOSE_SYMBOL](): void;
    /** Execute all queued cleanups in LIFO order. Idempotent. */
    dispose(): void;
}
/**
 * Affine single-ownership wrapper: the underlying resource has exactly one
 * owner at any time. `.move()` transfers ownership (invalidating the source),
 * `.use()` borrows it, and `.dispose()` releases it exactly once.
 */
export declare class Owned<T> implements Disposable {
    private _value;
    private _disposer;
    private _alive;
    constructor(resource: T, disposer: (val: T) => void);
    /** Borrow the inner resource. Throws if already moved or disposed. */
    use<R>(fn: (resource: T) => R): R;
    /** Transfer ownership to a new handle; the current one is invalidated. */
    move(): Owned<T>;
    /** Native disposal protocol entry point. */
    [DISPOSE_SYMBOL](): void;
    /** Invoke the disposer exactly once and mark the handle as dead. */
    dispose(): void;
    /** True while the resource has not been moved or disposed. */
    isAlive(): boolean;
}
export {};
//# sourceMappingURL=Memory.d.ts.map