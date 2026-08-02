import { DisposalStack, Owned } from './Memory.js';
import type { AppContent, AppManifest, SecurityOptions } from '../types/desktop.js';
export interface PrestigeConfig {
    container?: Document | HTMLElement;
    apps?: Record<string, AppManifest>;
    gpuAcceleration?: boolean;
    animations?: boolean;
    particleExplosion?: boolean;
    dock?: boolean;
    topdock?: boolean;
    clock?: boolean;
    session?: boolean;
    search?: boolean;
    windowSwitcher?: boolean;
    dockDragDrop?: boolean;
    expose?: boolean;
    xray?: boolean;
    snap?: boolean;
    shakeToMinimize?: boolean;
    flickToMinimize?: boolean;
    grid?: boolean;
    lockScreen?: boolean;
    tiling?: boolean;
    minimizedPreview?: boolean;
    toastCenter?: boolean;
    lockPassword?: string;
    renderTitlebar?: (label: string, icon?: string) => Node | string;
    security?: SecurityOptions;
}
/** Window element extended with its lifecycle disposal stack. */
export type WindowElement = HTMLDivElement & {
    _disposal: DisposalStack | null;
    _exposeClickHandler?: (event: Event) => void;
};
export interface WindowRecord {
    el: WindowElement;
    icon?: string;
    label?: string;
    btn?: HTMLElement | null;
    minimized: boolean;
    zoomed: boolean;
    transitionVersion: number;
}
interface OpenWindowOptions {
    animate?: boolean;
    focus?: boolean;
    save?: boolean;
    applyManifestMaximized?: boolean;
}
export type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type SnapZone = 'top' | 'left' | 'right';
interface SafeBounds {
    top: number;
    bottom: number;
    left: number;
    right: number;
}
interface MaximizeTarget {
    top: number;
    left: number;
    width: number;
    height: number;
    halfWidth: number;
}
/** Engine services the window manager needs. Implemented by the Prestige class. */
export interface WindowManagerHost {
    _query(selector: string): Element | null;
    _queryAll(selector: string): NodeListOf<Element>;
    _listen(target: EventTarget, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    _emit(event: string, payload: unknown): void;
    _mountNode(node: Node): Node;
    readonly config: PrestigeConfig;
    readonly animationsEnabled: boolean;
    dialogInfo(message: string): Promise<unknown>;
    _saveSession(): void;
}
/**
 * Owns window state (open windows, z-order, cascade, snap preview) and all
 * window lifecycle / geometry / gesture logic. Hosted by the Prestige engine.
 */
export declare class WindowManager {
    private readonly _host;
    private readonly _openWindows;
    private _zCounter;
    private _cascadeIndex;
    private _snapPreviewEl;
    constructor(_host: WindowManagerHost);
    getSafeBounds(): SafeBounds;
    _getMaximizeTarget(): MaximizeTarget;
    private _calculateDockTransform;
    toggleBounce(section: string): void;
    private _defaultControls;
    private _defaultTitlebar;
    private _buildTitlebar;
    private _statCard;
    /** Create the built-in window content (structural). */
    createContent(section: string, label?: string, icon?: string): AppContent;
    nextCascadePos(): {
        x: number;
        y: number;
    };
    createWindow(section: string, icon?: string, label?: string): WindowElement;
    openWindow(section: string, icon?: string, label?: string, dockBtn?: HTMLElement | null, options?: OpenWindowOptions): WindowElement | undefined;
    closeWindow(win: WindowElement): void;
    ownResource<T>(win: WindowElement, resource: T, disposer: (value: T) => void): Owned<T>;
    ownSocket(win: WindowElement, url: string, protocols?: string | string[]): Owned<WebSocket>;
    minimizeWindow(win: WindowElement): void;
    restoreWindow(win: WindowElement): void;
    toggleMaximize(win: WindowElement, save?: boolean): void;
    focusWindow(win: WindowElement): void;
    startDrag(win: WindowElement, e: MouseEvent | TouchEvent): void;
    startResize(win: WindowElement, e: MouseEvent | TouchEvent, dir: ResizeDirection): void;
    _snapCheck(win: WindowElement): SnapZone | null;
    private _getSnapPreview;
    private _showSnapPreview;
    _snapClear(): void;
    _applySnapOnRelease(win: WindowElement, zone: SnapZone): void;
    _minimizeOtherWindows(win: WindowElement): void;
    _getSwitcherWindows(): WindowElement[];
    getOpenWindow(section: string): WindowRecord | undefined;
    getOpenWindowKeys(): string[];
    getOpenWindowCount(): number;
    /** Remove a specific record without allowing a stale callback to delete its replacement. */
    removeWindowRecord(record: WindowRecord, suppressSessionSave?: boolean): boolean;
    setWindowLogicalState(win: WindowElement, minimized?: boolean, zoomed?: boolean): void;
    isMinimized(recordOrWindow: WindowRecord | WindowElement): boolean;
    isZoomed(recordOrWindow: WindowRecord | WindowElement): boolean;
    private _recordFor;
    private _isCurrent;
    private _disposeWindow;
    /** Remove the shared snap-preview element (engine destroy). */
    disposeSnapPreview(): void;
    /** Replace content of a window body (returns the content element if present). */
    setWindowTitle(win: WindowElement, title: string): void;
    setWindowContent(win: WindowElement, content: Node | string): void;
    getWindowContent(win: WindowElement): HTMLElement | null;
    /** Internal: read the app manifest for a section. */
    private _appConfig;
}
export {};
//# sourceMappingURL=WindowManager.d.ts.map