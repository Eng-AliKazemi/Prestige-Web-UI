/**
 * Prestige UI — main library entry point & exports.
 *
 * ESM consumers import named exports (`import { Prestige, createBtn } from 'prestige-ui'`).
 * The UMD build (`dist/prestige.umd.cjs`) exposes the `Prestige` class as the
 * global with every named export attached (`Prestige.create(...)`,
 * `Prestige.createBtn(...)`, ...), mirroring the vanilla distribution.
 */
import { Prestige } from './core/DesktopEngine.js';
export { Prestige } from './core/DesktopEngine.js';
export { WindowManager, type PrestigeConfig, type ResizeDirection, type SnapZone, type WindowElement, type WindowRecord, } from './core/WindowManager.js';
export { DisposalStack, Owned } from './core/Memory.js';
export { PrestigeStore, type PrestigeStoreApi } from './core/Store.js';
export { ComponentRegistry, applyComponentOptions, defaultRegistry, type ComponentFactory, type ComponentHost, type ComponentOptions, } from './ui/ComponentRegistry.js';
export * from './utils/dom.js';
export * from './utils/sanitize.js';
export * from './ui/LucideIcons.js';
export * from './ui/Components.js';
export * from './ui/Dialogs.js';
export type * from './types/index.js';
/** TC39 Explicit Resource Management disposable contract (`Symbol.dispose`). */
export type Disposable = {
    [Symbol.dispose](): void;
};
export default Prestige;
//# sourceMappingURL=index.d.ts.map