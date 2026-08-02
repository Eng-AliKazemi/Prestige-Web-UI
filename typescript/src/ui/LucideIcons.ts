/* ═══════════════════════════════════════════════════════════════════════════
   Prestige UI — Typed Lucide Icon Registry & Runtime Renderer
   TypeScript port of src/lucide-icons.js. The curated SVG registry lives in
   lucide-icons-data.ts (generated); `IconName` is derived from its keys.
   ═══════════════════════════════════════════════════════════════════════════ */
import { ICONS } from './lucide-icons-data.js';

export { ICONS } from './lucide-icons-data.js';

/** Union of every curated icon name, derived from the registry keys. */
export type IconName = keyof typeof ICONS;

/** Attribute map applied to the produced SVG element. */
export type IconAttributes = Record<string, string>;

/** Curated dialog icon aliases (type -> icon name). */
export const DIALOG_ICON_NAMES = {
    info: 'info',
    warning: 'triangle-alert',
    danger: 'circle-alert',
    success: 'circle-check',
    question: 'circle-help',
    save: 'save',
    open: 'folder-open',
    close: 'x',
    check: 'check',
} as const;

export type DialogIconName = keyof typeof DIALOG_ICON_NAMES;

/** Resolve a raw name to a registry key, falling back to 'circle'. */
function resolveIconName(name: string | null | undefined): IconName {
    const key = typeof name === 'string' ? name.trim().toLowerCase() : '';
    return Object.hasOwn(ICONS, key) ? (key as IconName) : 'circle';
}

/**
 * Render an icon by name into a fresh SVG element. Unknown names resolve to
 * the 'circle' fallback (same as placeholder rendering), so a mistyped name
 * in userland code degrades gracefully instead of throwing. The registry
 * source is parsed via DOMParser (not innerHTML concatenation) and imported
 * into the active document.
 */
export function createIcon(name: IconName, attrs?: IconAttributes): SVGElement {
    const key = resolveIconName(name);
    const source = ICONS[key];
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    const root = parsed.documentElement;
    if (!root) {
        throw new Error(`[LucideIcons] Unable to parse icon source for "${name}".`);
    }
    const node = document.importNode(root, true);
    if (!(node instanceof SVGElement)) {
        throw new Error(`[LucideIcons] Parsed icon source for "${name}" is not an SVG element.`);
    }
    if (attrs) {
        if (attrs.class) node.setAttribute('class', attrs.class);
        if (attrs.title) node.setAttribute('aria-label', attrs.title);
        if (attrs['aria-hidden'] != null) node.setAttribute('aria-hidden', attrs['aria-hidden']);
        if (attrs.role) node.setAttribute('role', attrs.role);
        if (attrs.style) node.setAttribute('style', attrs.style);
    }
    return node;
}

/** Replace a `<i data-prestige-icon="...">` placeholder with its SVG. */
function renderPlaceholder(placeholder: Element, nameAttr: string): void {
    if (placeholder.getAttribute('data-prestige-rendered') === 'true') return;
    const name = placeholder.getAttribute(nameAttr);
    const resolved = resolveIconName(name);

    const attrs: IconAttributes = {
        class: placeholder.getAttribute('class') ?? '',
        title: placeholder.getAttribute('title') ?? '',
        role: placeholder.getAttribute('role') ?? '',
        style: placeholder.getAttribute('style') ?? '',
    };
    const ariaHidden = placeholder.getAttribute('aria-hidden');
    if (ariaHidden !== null) attrs['aria-hidden'] = ariaHidden;

    const svg = createIcon(resolved, attrs);
    svg.setAttribute('data-prestige-icon', resolved);
    svg.setAttribute('data-prestige-rendered', 'true');
    placeholder.replaceWith(svg);
}

/** Render every icon placeholder within a scope (defaults to the document). */
export function renderIcons(root?: ParentNode): ParentNode {
    const scope: ParentNode = root && typeof root.querySelectorAll === 'function' ? root : document;
    scope.querySelectorAll('[data-prestige-icon]').forEach((el) => {
        renderPlaceholder(el, 'data-prestige-icon');
    });
    return scope;
}

/** Create the icon used by a dialog type, falling back to a raw icon name. */
export function dialogIcon(name: string): SVGElement {
    const mapped = Object.hasOwn(DIALOG_ICON_NAMES, name) ? DIALOG_ICON_NAMES[name as DialogIconName] : undefined;
    return createIcon(mapped || resolveIconName(name));
}
