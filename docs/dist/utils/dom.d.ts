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
export declare function $id(id: string): HTMLElement | null;
/** Create a text node (never parses markup). */
export declare function $text(str: string): Text;
/** Set an attribute only when it cannot introduce script-capable markup or an unsafe URL. */
export declare function setSafeAttribute(element: HTMLElement, name: string, value: string | number | boolean): void;
/**
 * Build a DOM element structurally. Returns the typed element so properties
 * are available without casts, e.g. `$tag('input', { type: 'text' }).value`.
 */
export declare function $tag<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: TagAttributes, children?: readonly TagChild[]): HTMLElementTagNameMap[K];
/**
 * Replace a parent's children with `content`. Strings render as plain text by
 * default; only `trustedHtml === true` routes through a sanitizer. When
 * `sanitizer` is supplied it is used on the trusted path, otherwise the
 * built-in TreeWalker sanitizer is used.
 */
export declare function replaceContent(parent: HTMLElement, content: Node | string | null | undefined, trustedHtml?: boolean, sanitizer?: CustomSanitizer | null): void;
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
export declare function isolatedPostTargetOrigin(sandboxValue: string, src: string | undefined, baseUrl: string): string;
/** Focusable (tabbable) elements inside `root`, in document order. */
export declare function focusablesWithin(root: Element): HTMLElement[];
/**
 * Modal focus trap. Keeps Tab / Shift+Tab cycling inside `root` so keyboard
 * focus cannot escape an `aria-modal` dialog. Call from the dialog's keydown
 * handler; does nothing for non-Tab keys.
 */
export declare function trapFocusWithin(root: Element, event: KeyboardEvent): void;
//# sourceMappingURL=dom.d.ts.map