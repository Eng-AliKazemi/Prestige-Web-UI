import { ICONS } from './lucide-icons-data.js';
export { ICONS } from './lucide-icons-data.js';
/** Union of every curated icon name, derived from the registry keys. */
export type IconName = keyof typeof ICONS;
/** Attribute map applied to the produced SVG element. */
export type IconAttributes = Record<string, string>;
/** Curated dialog icon aliases (type -> icon name). */
export declare const DIALOG_ICON_NAMES: {
    readonly info: "info";
    readonly warning: "triangle-alert";
    readonly danger: "circle-alert";
    readonly success: "circle-check";
    readonly question: "circle-help";
    readonly save: "save";
    readonly open: "folder-open";
    readonly close: "x";
    readonly check: "check";
};
export type DialogIconName = keyof typeof DIALOG_ICON_NAMES;
/**
 * Render an icon by name into a fresh SVG element. Unknown names resolve to
 * the 'circle' fallback (same as placeholder rendering), so a mistyped name
 * in userland code degrades gracefully instead of throwing. The registry
 * source is parsed via DOMParser (not innerHTML concatenation) and imported
 * into the active document.
 */
export declare function createIcon(name: IconName, attrs?: IconAttributes): SVGElement;
/** Render every icon placeholder within a scope (defaults to the document). */
export declare function renderIcons(root?: ParentNode): ParentNode;
/** Create the icon used by a dialog type, falling back to a raw icon name. */
export declare function dialogIcon(name: string): SVGElement;
//# sourceMappingURL=LucideIcons.d.ts.map