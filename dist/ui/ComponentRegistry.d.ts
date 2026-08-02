import type { SecurityHost } from '../types/desktop.js';
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
/** Apply the generic options (id / className / attributes / data / style). */
export declare function applyComponentOptions(element: HTMLElement, options: ComponentOptions): HTMLElement;
/** Registry of named component factories with a Prestige-compatible API. */
export declare class ComponentRegistry {
    private readonly _factories;
    /** Register a factory. Throws on duplicate names unless `{ replace: true }`. */
    register(name: string, factory: ComponentFactory, options?: {
        replace?: boolean;
    }): this;
    /** Remove a registered factory. */
    unregister(name: string): this;
    /** True when a factory is registered under `name`. */
    has(name: string): boolean;
    /** The raw factory for `name`, or null. */
    get(name: string): ComponentFactory | null;
    /** Sorted list of registered component names. */
    list(): string[];
    /** Instantiate a registered component. Throws for unknown names. */
    create(name: string, options?: ComponentOptions, instance?: ComponentHost): HTMLElement;
}
/** Shared registry for the built-in primitives. */
export declare const defaultRegistry: ComponentRegistry;
//# sourceMappingURL=ComponentRegistry.d.ts.map