import { type PrestigeConfig, type WindowElement } from './WindowManager.js';
import { PrestigeStore } from './Store.js';
import { type ComponentFactory, type ComponentOptions } from '../ui/ComponentRegistry.js';
import { type DialogHost, type DialogOptions, type SaveDialogResult } from '../ui/Dialogs.js';
import { type DrawerApi, type ToastApi } from '../ui/Components.js';
import type { AppManifest, WindowState } from '../types/desktop.js';
export interface ContextMenuItem {
    label?: string;
    sep?: boolean;
    checked?: boolean;
    kbd?: string;
    disabled?: boolean;
    onclick?: () => void;
}
export interface ContextMenuOptions {
    x?: number;
    y?: number;
    items?: ContextMenuItem[];
}
declare const PLACEMENTS: readonly ["dock", "topdock", "hidden", "both"];
type AppPlacementValue = (typeof PLACEMENTS)[number];
/**
 * Zero-dependency desktop shell engine. Instantiate via `new Prestige(config)`
 * or `Prestige.create(config)`, then `init()`.
 */
export declare class Prestige implements DialogHost {
    readonly config: PrestigeConfig;
    readonly user: PrestigeConfig;
    readonly root: Document | HTMLElement;
    private readonly _ownedRoot;
    private readonly _ownedNodes;
    private _listenerController;
    private _destroyed;
    private _initialized;
    private _animationsEnabled;
    private _listeners;
    private readonly _gpuAcceleration;
    private readonly _animations;
    private readonly _particleExplosion;
    private readonly _dock;
    private readonly _topdock;
    private readonly _clock;
    private readonly _session;
    private readonly _search;
    private readonly _windowSwitcher;
    private readonly _dockDragDrop;
    private readonly _expose;
    private readonly _xray;
    private readonly _snap;
    private readonly _grid;
    private readonly _lockScreen;
    private readonly _tiling;
    private readonly _minimizedPreview;
    private readonly _toastCenter;
    private readonly _wm;
    private _dragWasDrag;
    private _switcherEl;
    private _switcherActive;
    private _switcherIndex;
    private _searchEl;
    private _searchEscListener;
    private _xrayActive;
    private _exposeActive;
    private _exposeSavedRects;
    private _hotCornerCooldown;
    private _contentCache;
    private _clockInterval;
    private _lockActive;
    private _lockInterval;
    private _toasts;
    private _tileActive;
    private _tileSaved;
    private _previewWin;
    private _previewSection;
    private _previewOrigin;
    private _store;
    private _ctxMenuEl;
    private _ctxMenuHandler;
    private _ctxMenuKeyHandler;
    private _ctxMenuPreviousFocus;
    private readonly _DOCK_ORDER_KEY;
    private readonly _TOPDOCK_ORDER_KEY;
    constructor(config?: PrestigeConfig);
    /**
     * Validate the `security` options block at construction. Enforces the
     * "no fake crypto" rule (encryption requires an app-owned, persistable key)
     * and emits a loud `console.warn` for any option that weakens a secure
     * default.
     */
    private _validateSecurityConfig;
    get animationsEnabled(): boolean;
    _query(selector: string): Element | null;
    _queryAll(selector: string): NodeListOf<Element>;
    _listen(target: EventTarget, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    _mountNode(node: Node): Node;
    _unmountNode(node: Node | null): void;
    on(event: string, fn: (payload: unknown) => void): this;
    off(event: string, fn?: (payload: unknown) => void): this;
    _emit(event: string, payload: unknown): void;
    init(): this;
    private _createGrid;
    private _setDataColors;
    bindDock(): void;
    bindTopDock(): void;
    private _saveDockOrder;
    private _saveTopdockOrder;
    private _restoreOrder;
    private _restoreDockOrder;
    private _restoreTopdockOrder;
    private _initDockDragDrop;
    private _createDragGhost;
    private _removeDragGhost;
    bindDockScroll(): void;
    updateDockScrollButtons(): void;
    bindCanvasClick(): void;
    bindKeyboard(): void;
    enableXRay(): void;
    disableXRay(): void;
    peekXRay(): void;
    checkHotCorners(e: MouseEvent): void;
    toggleExpose(enable?: boolean): void;
    private _removeAllWindows;
    closeAllWindows(): void;
    explodeAndCloseAll(): void;
    private _tileWindows;
    private _untileWindows;
    private _showMinimizedPreview;
    private _hideMinimizedPreview;
    notify(type: 'info' | 'success' | 'warning' | 'error', title: string, message?: string): void;
    private _toggleToastCenter;
    private _createToastCenter;
    private _renderToastCenter;
    private _timeAgo;
    registerApp(appId: string, manifest: Partial<AppManifest>): this;
    private _applyInitialPlacements;
    private _buildDockItem;
    private _readAppMeta;
    setAppPlacement(appId: string, placement: AppPlacementValue): this;
    /** Reset an app to its manifest-declared placement (clears the persisted override). */
    resetAppPlacement(appId: string): this;
    /** Internal placement application. Persists the override only when `persist` is set. */
    private _setAppPlacement;
    /** Resolve an app's effective placement: persisted override, then manifest, then 'dock'. */
    private _getAppPlacement;
    private _getPersistedPlacement;
    /** Right-click placement menu for dock / topdock items (change or reset placement). */
    private _showDockPlacementMenu;
    private _appendToDock;
    private _addTopdockItem;
    private _showSwitcher;
    private _highlightSwitcher;
    private _hideSwitcher;
    showSearch(): void;
    private _searchHighlight;
    private _searchNavigate;
    private _closeSearch;
    startClock(): void;
    cacheContent(key: string, value: unknown): void;
    getCachedContent(key: string): unknown;
    clearContentCache(key?: string): void;
    getState(): WindowState[];
    setState(states: WindowState[]): void;
    _saveSession(): void;
    private _restoreSession;
    lock(): void;
    unlock(password: string): void;
    get store(): PrestigeStore;
    syncUrlState(): string[];
    openWindow(section: string, icon?: string, label?: string, dockBtn?: HTMLElement | null): WindowElement | undefined;
    closeWindow(win: WindowElement): void;
    minimizeWindow(win: WindowElement): void;
    restoreWindow(win: WindowElement): void;
    toggleMaximize(win: WindowElement): void;
    focusWindow(win: WindowElement): void;
    setWindowTitle(win: WindowElement, title: string): void;
    setWindowContent(win: WindowElement, content: Node | string): void;
    getWindowContent(win: WindowElement): HTMLElement | null;
    ownResource<T>(win: WindowElement, resource: T, disposer: (value: T) => void): import("./Memory.js").Owned<T>;
    ownSocket(win: WindowElement, url: string, protocols?: string | string[]): import("./Memory.js").Owned<WebSocket>;
    toggleBounce(section: string): void;
    dialogShow(opts: DialogOptions): Promise<unknown>;
    dialogInfo(o?: string | DialogOptions): Promise<true>;
    dialogWarning(o?: string | DialogOptions): Promise<true>;
    dialogDanger(o?: string | DialogOptions): Promise<true>;
    dialogAlert(o?: string | DialogOptions): Promise<true>;
    dialogConfirm(o?: string | DialogOptions): Promise<boolean>;
    dialogPrompt(o?: string | DialogOptions): Promise<string | null>;
    dialogSave(o?: string | DialogOptions): Promise<SaveDialogResult>;
    dialogOpen(o?: string | DialogOptions): Promise<FileList | null>;
    toast(message: unknown, type?: 'info' | 'success' | 'warning' | 'error', duration?: number): ToastApi;
    customModal(options: {
        title?: string;
        ariaLabel?: string;
        width?: number;
        body?: unknown;
        trustedHtml?: boolean;
        buttons?: Array<{
            label?: string;
            variant?: 'primary' | 'success' | 'danger' | 'ghost';
            value?: unknown;
            disabled?: boolean;
        }>;
        closeOnEscape?: boolean;
        closeOnBackdrop?: boolean;
        closeValue?: unknown;
        onClose?: (value: unknown, reason?: string) => void;
    }): Promise<unknown>;
    drawer(options: {
        title?: string;
        side?: 'left' | 'right';
        width?: number;
        content?: unknown;
        trustedHtml?: boolean;
        closeOnEscape?: boolean;
        closeOnBackdrop?: boolean;
        ariaLabel?: string;
        onClose?: (reason: string) => void;
    }): DrawerApi;
    showContextMenu(opts: ContextMenuOptions): void;
    hideContextMenu(): void;
    destroy(): void;
    static create(config?: PrestigeConfig): Prestige;
    static mixin(descriptor: Record<string, unknown>): void;
    /** Shared component registry (drop-in for the vanilla `Prestige.components`). */
    static components: import("../ui/ComponentRegistry.js").ComponentRegistry;
    /** Register a component factory. */
    static registerComponent(name: string, factory: ComponentFactory, options?: {
        replace?: boolean;
    }): typeof Prestige;
    /** Unregister a component factory. */
    static unregisterComponent(name: string): typeof Prestige;
    /** Check whether a component is registered. */
    static hasComponent(name: string): boolean;
    /** Retrieve a registered component factory. */
    static getComponent(name: string): ComponentFactory | null;
    /** List all registered component names. */
    static listComponents(): string[];
    /** Instantiate a registered component via the shared registry. */
    createComponent(name: string, options?: ComponentOptions): HTMLElement;
    private _getFocusedWindow;
}
export type { WindowElement, WindowRecord, SnapZone } from './WindowManager.js';
//# sourceMappingURL=DesktopEngine.d.ts.map