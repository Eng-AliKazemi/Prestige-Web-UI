import type { CustomSanitizer } from '../types/desktop.js';
/**
 * Escape a string so that it can be safely embedded as text inside HTML.
 * Reads the escaped representation back from a detached element's DOM.
 */
export declare function escapeHtml(value: string): string;
/**
 * Conservative sanitizer for the explicit `trustedHtml` compatibility path.
 *
 * Parses markup inside a detached `<template>` (scripts never execute), then
 * strips dangerous elements (`script`, `style`, `iframe`, `object`, `form`,
 * input controls, ...), inline `on*` handlers, `style`/`srcdoc`/`nonce`, and
 * URLs that use unsafe schemes. Returns a safe `DocumentFragment`.
 */
export declare function sanitizeHtml(html: string): DocumentFragment;
/**
 * Trusted-callback sanitizer for string output from `renderTitlebar`.
 *
 * `renderTitlebar` is developer-authored code with the same trust boundary as
 * returning a DOM `Node`, so this relaxes the untrusted-content blocklist: the
 * `<button>` elements a custom titlebar needs for its window controls survive,
 * and inline `style` attributes are kept. Active-execution vectors are still
 * removed (`script`/`iframe`/`object`/`embed`/`form`/`input`/... plus inline
 * `on*` handlers, `srcdoc`, `nonce`, and unsafe URLs), so a titlebar label must
 * still be HTML-escaped by the caller. Returns a safe `DocumentFragment`.
 */
export declare function sanitizeTitlebarHtml(html: string): DocumentFragment;
/**
 * Dispatch HTML sanitization through a caller-supplied sanitizer when one is
 * configured, falling back to the built-in TreeWalker `sanitizeHtml`.
 *
 * A custom sanitizer is a fully trusted security boundary: when it returns a
 * string, that string is parsed into a detached `<template>` WITHOUT being
 * re-sanitized. Only pass sanitizers you trust (e.g. a bundled DOMPurify).
 */
export declare function sanitizeWith(dirty: string, sanitizer?: CustomSanitizer | null): DocumentFragment;
/** Validate an app identifier against /^[A-Za-z][A-Za-z0-9_-]{0,63}$/. */
export declare function isSafeAppId(value: string): boolean;
/**
 * True when a URL string starts with a scheme/prefix that cannot smuggle
 * script execution (`javascript:`, `data:`, `vbscript:` are rejected).
 * Allows http(s), mailto, tel, fragment, and absolute/relative paths.
 */
export declare function isSafeUrl(value: string): boolean;
/**
 * True when a value is usable as a sandboxed iframe `src`: only `about:blank`
 * (the documented default), http(s), or a relative path. Absolute same-page
 * fragments and opaque protocols (`data:`, `blob:`, `javascript:`, ...) are
 * rejected — an untrusted manifest must never control active frame content.
 */
export declare function isSafeIframeSrc(value: string | null | undefined): boolean;
/** Throw unless `id` is a valid app identifier; returns the input unchanged. */
export declare function assertSafeAppId(id: string): string;
//# sourceMappingURL=sanitize.d.ts.map