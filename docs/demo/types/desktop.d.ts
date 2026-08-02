/**
 * Desktop windowing type contracts.
 *
 * Matches `docs/TYPESCRIPT.md` Phase 1 with the parity extensions mandated by
 * Rule 6 (preserve the existing `Prestige` public API): `AppManifest` retains
 * the optional `label` / `maximized` / `trustedHtml` fields that the runtime
 * `registerApp()` and `docs/PRESTIGE.md` §5 rely on, and `content` may return
 * a plain-text string (never raw HTML) in addition to a DOM node.
 */
/** Apps render either directly in the main DOM tree or inside a sandboxed iframe. */
export type AppIsolationTier = 'native' | 'isolated';
/** Dock placement of a registered app. */
export type AppPlacement = 'dock' | 'topdock' | 'both' | 'hidden';
/** App content factory result: a DOM node or a plain-text string (never raw HTML). */
export type AppContent = HTMLElement | string | null;
/**
 * Immutable app manifest. `id` and `title` are required; every other field is
 * optional and read-only.
 */
export interface AppManifest {
    /** Application identifier (must match /^[A-Za-z][A-Za-z0-9_-]{0,63}$/). */
    readonly id: string;
    /** Display label. Falls back to `label` then to the appId at runtime. */
    readonly title: string;
    /** Secondary label used for dock tooltips. */
    readonly label?: string;
    /** Offline Lucide icon registry name. */
    readonly icon?: string;
    /** Dock placement. Defaults to 'dock'. */
    readonly placement?: AppPlacement;
    /** Isolation tier. Defaults to 'native'. */
    readonly tier?: AppIsolationTier;
    /** Document URL for `tier: 'isolated'` sandboxed iframes. Scheme-validated at runtime: only `about:blank`, http(s), or relative paths are honored — anything else silently falls back to `about:blank`. */
    readonly src?: string;
    /** Dock icon gradient start color (e.g. '#fbe482'). */
    readonly c1?: string;
    /** Dock icon gradient end color (e.g. '#000000'). */
    readonly c2?: string;
    /** Window width hint in px. Falls back to the per-section default. */
    readonly w?: number;
    /** Window height hint in px. Falls back to the per-section default. */
    readonly h?: number;
    /** Maximum number of concurrently open windows for this app. */
    readonly maxCount?: number;
    /** Open the window pre-maximized. Defaults to false. */
    readonly maximized?: boolean;
    /** Opt-in to HTML content parsing routed through the TreeWalker sanitizer. */
    readonly trustedHtml?: boolean;
    /** Content factory returning a DOM node or plain text. */
    readonly content?: (section: string, label: string, icon?: string) => AppContent;
}
/**
 * Serialized window geometry produced by `getState()` and consumed by
 * `setState()`. Only `id` is read-only; geometry is intentionally mutable so a
 * restored window can be repositioned before being re-rendered.
 */
export interface WindowState {
    readonly id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minimized: boolean;
    zoomed: boolean;
    title: string;
}
/** Safe draggable canvas bounds returned by `getSafeBounds()`. */
export interface SafeBounds {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
}
/** Maximize / snap geometry computed by `_getMaximizeTarget()`. */
export interface MaximizeTarget {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
    readonly halfWidth: number;
}
/** Custom HTML sanitizer: returns a safe fragment, or a raw HTML string that
 *  is parsed into a detached `<template>` (fully trusted — not re-sanitized). */
export type CustomSanitizer = (dirty: string) => DocumentFragment | string;
/** Resolver for the PRESTIGE_INIT postMessage `targetOrigin` of an
 *  isolated-tier iframe. Defaults to `isolatedPostTargetOrigin`. */
export type TargetOriginResolver = (sandbox: string, src: string | undefined, base: string) => string;
/** Supplies an app-owned AES-GCM key for encrypted store persistence. Must
 *  return a persistable key (e.g. PBKDF2-derived from a passphrase); the
 *  library never generates a key that would be lost on reload. */
export type StorageKeyProvider = () => Promise<CryptoKey | null>;
/** Minimal host surface exposing the security options block. */
export interface SecurityHost {
    config?: {
        security?: SecurityOptions;
    } | undefined;
}
/**
 * Constructor-driven security hooks. Every option is `null` / `true` /
 * `'deny-secrets'` by default, so omitting the block preserves the current,
 * tested behavior exactly.
 */
export interface SecurityOptions {
    /** Custom sanitizer used on the `trustedHtml` path. Defaults to the
     *  built-in TreeWalker `sanitizeHtml`. */
    readonly sanitizer?: CustomSanitizer | null;
    /** Store persistence policy. `'deny-secrets'` refuses credential-like
     *  keys; `'encrypted'` requires `storageKeyProvider`. */
    readonly storage?: 'deny-secrets' | 'encrypted';
    /** App-owned key for `'encrypted'` store persistence. Required iff
     *  `storage === 'encrypted'`. */
    readonly storageKeyProvider?: StorageKeyProvider;
    /** Override the isolated-tier postMessage `targetOrigin` resolver.
     *  Defaults to `isolatedPostTargetOrigin`. */
    readonly postTargetOrigin?: TargetOriginResolver | null;
    /** Toggle the clickjacking visual-safety check in the web3 transaction
     *  guard. Defaults to true. */
    readonly clickjackCheck?: boolean;
}
//# sourceMappingURL=desktop.d.ts.map