/* ═══════════════════════════════════════════════════════════════════════════
   Prestige UI — Safe Structural DOM Builders
   TypeScript port of the DOM helpers in src/utils.js. All UI is constructed
   with DOM node methods ($tag / $text); no innerHTML string building.
   ═══════════════════════════════════════════════════════════════════════════ */
import { isSafeIframeSrc, isSafeUrl, sanitizeWith } from './sanitize.js';
import type { CustomSanitizer } from '../types/desktop.js';

/** Event handler accepted by `$tag` via `on*` attributes. */
export type EventHandler = (event: Event) => void;

/** Style object merged into `el.style` via Object.assign. */
export type StyleAttributes = Partial<CSSStyleDeclaration>;

/**
 * Attributes for `$tag`. Special keys: `class` sets className, `style` is
 * merged into `el.style`, `on*` binds function-valued event listeners. String
 * event handlers, `srcdoc`, and unsafe URL values are omitted. A `true` value
 * emits a bare attribute; `false`/`undefined` are skipped.
 */
export type TagAttributes = {
    class?: string;
    style?: StyleAttributes;
    srcdoc?: never;
    [key: `on${string}`]: EventHandler | undefined;
    [key: string]: string | number | boolean | undefined | StyleAttributes | EventHandler;
};

/** Child accepted by `$tag`: DOM nodes are appended, strings become text. */
export type TagChild = Node | string | number | null | undefined;

/** Look up an element by id, or null when absent. */
export function $id(id: string): HTMLElement | null {
    return document.getElementById(id);
}

/** Create a text node (never parses markup). */
export function $text(str: string): Text {
    return document.createTextNode(str);
}

const URL_ATTRIBUTE = /(?:^|:)(href|src|action|formaction|poster|cite)$/i;

function isSafeRelativeUrl(value: string): boolean {
    const normalizedValue = value.trim().replace(/[\u0000-\u001f\u007f]/g, '');
    return !/^[a-z][a-z0-9+.-]*:/i.test(normalizedValue);
}

/** Set an attribute only when it cannot introduce script-capable markup or an unsafe URL. */
export function setSafeAttribute(element: HTMLElement, name: string, value: string | number | boolean): void {
    const normalizedName = name.toLowerCase();
    if (normalizedName.startsWith('on') || normalizedName === 'srcdoc') return;

    if (value === true) {
        element.setAttribute(name, '');
        return;
    }

    const stringValue = String(value);
    if (URL_ATTRIBUTE.test(normalizedName)) {
        const acceptedByPolicy = normalizedName === 'src' && element.tagName === 'IFRAME'
            ? isSafeIframeSrc(stringValue)
            : isSafeUrl(stringValue);
        if (!acceptedByPolicy && !isSafeRelativeUrl(stringValue)) return;
    }
    element.setAttribute(name, stringValue);
}

/**
 * Build a DOM element structurally. Returns the typed element so properties
 * are available without casts, e.g. `$tag('input', { type: 'text' }).value`.
 */
export function $tag<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs?: TagAttributes,
    children?: readonly TagChild[],
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            if (value === undefined || value === false) continue;
            if (key === 'class' && typeof value === 'string') {
                el.className = value;
            } else if (key === 'style' && typeof value === 'object' && value !== null) {
                Object.assign(el.style, value);
            } else if (key.toLowerCase().startsWith('on')) {
                if (typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                setSafeAttribute(el, key, value as string | number | boolean);
            }
        }
    }
    if (children) {
        for (const child of children) {
            if (child == null) continue;
            if (child instanceof Node) el.appendChild(child);
            else el.appendChild($text(String(child)));
        }
    }
    return el;
}

/**
 * Replace a parent's children with `content`. Strings render as plain text by
 * default; only `trustedHtml === true` routes through a sanitizer. When
 * `sanitizer` is supplied it is used on the trusted path, otherwise the
 * built-in TreeWalker sanitizer is used.
 */
export function replaceContent(
    parent: HTMLElement,
    content: Node | string | null | undefined,
    trustedHtml?: boolean,
    sanitizer?: CustomSanitizer | null,
): void {
    while (parent.firstChild) parent.removeChild(parent.firstChild);
    if (content == null) return;
    if (content instanceof Node) {
        parent.appendChild(content);
        return;
    }
    if (trustedHtml === true) {
        parent.appendChild(sanitizeWith(String(content), sanitizer));
        return;
    }
    parent.appendChild($text(String(content)));
}

/**
 * Resolve the correct `targetOrigin` for the PRESTIGE_INIT postMessage to an
 * isolated-tier iframe.
 *
 * A sandboxed iframe WITHOUT the `allow-same-origin` token runs in an opaque
 * origin, so a concrete targetOrigin can never match and the message is
 * silently dropped by the browser — `'*'` is the only valid value there. When
 * `allow-same-origin` IS granted, the frame keeps a real origin and we pin the
 * target to the frame's own origin (from `src`, else the host origin).
 */
export function isolatedPostTargetOrigin(sandboxValue: string, src: string | undefined, baseUrl: string): string {
    const tokens = sandboxValue.split(/\s+/).filter(Boolean);
    if (!tokens.includes('allow-same-origin')) return '*';
    if (src && /^https?:/i.test(src)) {
        try {
            return new URL(src, baseUrl).origin;
        } catch {
            /* fall through to the host origin on malformed src */
        }
    }
    return new URL(baseUrl).origin;
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function isFocusable(el: HTMLElement): boolean {
    if (el.hasAttribute('disabled')) return false;
    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null && Number(tabindex) < 0) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return true;
}

/** Focusable (tabbable) elements inside `root`, in document order. */
export function focusablesWithin(root: Element): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable);
}

/**
 * Modal focus trap. Keeps Tab / Shift+Tab cycling inside `root` so keyboard
 * focus cannot escape an `aria-modal` dialog. Call from the dialog's keydown
 * handler; does nothing for non-Tab keys.
 */
export function trapFocusWithin(root: Element, event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusables = focusablesWithin(root);
    if (focusables.length === 0) {
        event.preventDefault();
        (root as HTMLElement).focus();
        return;
    }
    const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
    if (event.shiftKey) {
        event.preventDefault();
        focusables[currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1].focus();
    } else {
        event.preventDefault();
        focusables[currentIndex < 0 || currentIndex === focusables.length - 1 ? 0 : currentIndex + 1].focus();
    }
}
