/* ═══════════════════════════════════════════════════════════════════════════
   Prestige UI — Extensible Component Factory System
   TypeScript port of the `Prestige.registerComponent` / `Prestige.components`
   registry from src/prestige-components.js. Framework-agnostic: any host
   object implementing `ComponentHost` can power instance-aware components.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { SecurityHost } from '../types/desktop.js';
import { setSafeAttribute } from '../utils/dom.js';

/** Generic options every registered component accepts. */
export interface ComponentOptions {
    id?: string;
    className?: string;
    attributes?: Readonly<Record<string, string | number | boolean | null | undefined>>;
    data?: Readonly<Record<string, string | number | boolean>>;
    style?: Partial<CSSStyleDeclaration>;
    [key: string]: unknown;
}

/** The minimal host surface instance-aware components may use. */
export interface ComponentHost extends SecurityHost {
    _listen?(target: EventTarget, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    _query?(selector: string): Element | null;
    _mountNode?(node: Node): Node;
}

/** Factory producing a DOM element from options and an optional host. */
export type ComponentFactory = (options: ComponentOptions, instance?: ComponentHost) => HTMLElement;

const PROTECTED_GENERATED_ATTRIBUTES = new Set(['crossorigin', 'integrity', 'nonce', 'referrerpolicy']);

function isProtectedGeneratedAttribute(element: HTMLElement, name: string): boolean {
    const normalizedName = name.toLowerCase();
    if (!element.hasAttribute(normalizedName)) return false;
    if (PROTECTED_GENERATED_ATTRIBUTES.has(normalizedName)) return true;
    if (element.tagName === 'IFRAME' && ['allow', 'credentialless', 'csp', 'sandbox'].includes(normalizedName)) return true;
    if (normalizedName === 'rel') {
        return /(?:^|\s)(?:noopener|noreferrer)(?:\s|$)/i.test(element.getAttribute('rel') ?? '');
    }
    return false;
}

/** Apply the generic options (id / className / attributes / data / style). */
export function applyComponentOptions(element: HTMLElement, options: ComponentOptions): HTMLElement {
    if (options.id) element.id = options.id;
    if (options.className) {
        const names = String(options.className).split(/\s+/).filter(Boolean);
        if (names.length) element.classList.add(...names);
    }
    if (options.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
            if (isProtectedGeneratedAttribute(element, key)) continue;
            if (value === false || value == null) element.removeAttribute(key);
            else setSafeAttribute(element, key, value);
        }
    }
    if (options.data) {
        for (const [key, value] of Object.entries(options.data)) element.dataset[key] = String(value);
    }
    if (options.style) Object.assign(element.style, options.style);
    return element;
}

/** Registry of named component factories with a Prestige-compatible API. */
export class ComponentRegistry {
    private readonly _factories = new Map<string, ComponentFactory>();

    /** Register a factory. Throws on duplicate names unless `{ replace: true }`. */
    public register(name: string, factory: ComponentFactory, options?: { replace?: boolean }): this {
        if (!name || typeof factory !== 'function') {
            throw new Error('register(name, factory) requires a name and factory.');
        }
        if (this._factories.has(name) && !options?.replace) {
            throw new Error(`Prestige component already registered: ${name}. Pass { replace: true } to replace it.`);
        }
        this._factories.set(name, (componentOptions, instance) => {
            const element = factory(componentOptions, instance);
            if (!(element instanceof HTMLElement)) {
                throw new Error(`Prestige component factory "${name}" must return an HTMLElement.`);
            }
            return applyComponentOptions(element, componentOptions);
        });
        return this;
    }

    /** Remove a registered factory. */
    public unregister(name: string): this {
        if (name) this._factories.delete(name);
        return this;
    }

    /** True when a factory is registered under `name`. */
    public has(name: string): boolean {
        return this._factories.has(name);
    }

    /** The raw factory for `name`, or null. */
    public get(name: string): ComponentFactory | null {
        return this._factories.get(name) ?? null;
    }

    /** Sorted list of registered component names. */
    public list(): string[] {
        return [...this._factories.keys()].sort();
    }

    /** Instantiate a registered component. Throws for unknown names. */
    public create(name: string, options: ComponentOptions = {}, instance?: ComponentHost): HTMLElement {
        const factory = this._factories.get(name);
        if (!factory) throw new Error(`Unknown Prestige component: ${name}`);
        return factory(options, instance);
    }
}

/** Shared registry for the built-in primitives. */
export const defaultRegistry = new ComponentRegistry();
