/* ═══════════════════════════════════════════════════════════════════════════
   Prestige UI — XSS & Input Sanitizers
   TypeScript port of the security helpers in src/utils.js.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { CustomSanitizer } from '../types/desktop.js';

// Active-vector and SVG elements that are safe to render as inert markup only.
// `foreignObject`/`use` are historical SVG XSS/mXSS vectors; `image`/`feImage`
// can trigger network requests to attacker-controlled URLs; the animation
// elements can rewrite attribute values (including `href`) at runtime.
const BLOCKED_TAGS = /^(script|style|iframe|object|embed|link|meta|base|form|textarea|input|button|animate|animateMotion|animateTransform|discard|foreignObject|use|image|feImage|set)$/i;
const URL_ATTRIBUTES = /(?:^|:)(href|src|action|formaction|poster|cite)$/i;
const SAFE_URL_START = /^(https?:|mailto:|tel:|#|\/|\.{1,2}\/)/i;

/**
 * Escape a string so that it can be safely embedded as text inside HTML.
 * Reads the escaped representation back from a detached element's DOM.
 */
export function escapeHtml(value: string): string {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}

/**
 * Conservative sanitizer for the explicit `trustedHtml` compatibility path.
 *
 * Parses markup inside a detached `<template>` (scripts never execute), then
 * strips dangerous elements (`script`, `style`, `iframe`, `object`, `form`,
 * input controls, ...), inline `on*` handlers, `style`/`srcdoc`/`nonce`, and
 * URLs that use unsafe schemes. Returns a safe `DocumentFragment`.
 */
export function sanitizeHtml(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = String(html);

    const elements: Element[] = [];
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node instanceof Element) elements.push(node);
    }

    for (const el of elements) {
        if (!template.content.contains(el)) continue;
        if (BLOCKED_TAGS.test(el.tagName)) {
            el.remove();
            continue;
        }
        for (let i = el.attributes.length - 1; i >= 0; i--) {
            const attr = el.attributes.item(i);
            if (!attr) continue;
            const name = attr.name.toLowerCase();
            if (name.startsWith('on') || name === 'style' || name === 'srcdoc' || name === 'nonce') {
                el.removeAttribute(attr.name);
                continue;
            }
            if (URL_ATTRIBUTES.test(name)) {
                const value = attr.value.trim();
                if (!SAFE_URL_START.test(value)) el.removeAttribute(attr.name);
            }
        }
    }

    return template.content;
}

/**
 * Dispatch HTML sanitization through a caller-supplied sanitizer when one is
 * configured, falling back to the built-in TreeWalker `sanitizeHtml`.
 *
 * A custom sanitizer is a fully trusted security boundary: when it returns a
 * string, that string is parsed into a detached `<template>` WITHOUT being
 * re-sanitized. Only pass sanitizers you trust (e.g. a bundled DOMPurify).
 */
export function sanitizeWith(dirty: string, sanitizer?: CustomSanitizer | null): DocumentFragment {
    if (sanitizer) {
        const result = sanitizer(String(dirty));
        if (result instanceof DocumentFragment) return result;
        if (typeof result === 'object' && result !== null) {
            // Cross-realm fragments fail `instanceof`; accept by nodeType.
            const node = result as { nodeType?: number };
            if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) return result as DocumentFragment;
        }
        const template = document.createElement('template');
        template.innerHTML = String(result);
        return template.content;
    }
    return sanitizeHtml(dirty);
}

/** Validate an app identifier against /^[A-Za-z][A-Za-z0-9_-]{0,63}$/. */
export function isSafeAppId(value: string): boolean {
    return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
}

/**
 * True when a URL string starts with a scheme/prefix that cannot smuggle
 * script execution (`javascript:`, `data:`, `vbscript:` are rejected).
 * Allows http(s), mailto, tel, fragment, and absolute/relative paths.
 */
export function isSafeUrl(value: string): boolean {
    return SAFE_URL_START.test(String(value).trim());
}

/**
 * True when a value is usable as a sandboxed iframe `src`: only `about:blank`
 * (the documented default), http(s), or a relative path. Absolute same-page
 * fragments and opaque protocols (`data:`, `blob:`, `javascript:`, ...) are
 * rejected — an untrusted manifest must never control active frame content.
 */
export function isSafeIframeSrc(value: string | null | undefined): boolean {
    if (!value) return true;
    const src = String(value).trim();
    if (src === 'about:blank') return true;
    if (/^https?:/i.test(src)) return true;
    return /^(\/|\.\/|\.\.\/)/.test(src);
}

/** Throw unless `id` is a valid app identifier; returns the input unchanged. */
export function assertSafeAppId(id: string): string {
    if (!isSafeAppId(id)) {
        throw new Error('Prestige app IDs must match /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.');
    }
    return id;
}
