/* ═══════════════════════════════════════════════════════════════════════════
   Prestige UI — Desktop Engine
   TypeScript port of src/core.js (+ prestigue-store URL sync). The Prestige
   class owns the desktop shell: dock / topdock, keyboard shortcuts, Spotlight
   search, Alt+` switcher, X-Ray, Exposé, lock screen, tiling, particle
   explosion, toast center, and session state. Window logic delegates to
   `WindowManager`. Structural DOM construction only (no innerHTML).
   ═══════════════════════════════════════════════════════════════════════════ */
import { $tag, $text, replaceContent } from '../utils/dom.js';
import { renderIcons } from '../ui/LucideIcons.js';
import {
    WindowManager,
    type PrestigeConfig,
    type WindowElement,
    type WindowRecord,
} from './WindowManager.js';
import { PrestigeStore } from './Store.js';
import { defaultRegistry, type ComponentFactory, type ComponentOptions } from '../ui/ComponentRegistry.js';
import {
    dialogAlert as showDialogAlert,
    dialogConfirm as showDialogConfirm,
    dialogDanger as showDialogDanger,
    dialogInfo as showDialogInfo,
    dialogOpen as showDialogOpen,
    dialogPrompt as showDialogPrompt,
    dialogSave as showDialogSave,
    dialogShow as showDialogShow,
    dialogWarning as showDialogWarning,
    type DialogHost,
    type DialogOptions,
    type SaveDialogResult,
} from '../ui/Dialogs.js';
import { createDrawer, createModal, createToast, type DrawerApi, type ToastApi, type ToastOptions } from '../ui/Components.js';
import type { AppManifest, SecurityOptions, WindowState } from '../types/desktop.js';
import { assertSafeAppId } from '../utils/sanitize.js';

interface ToastEntry {
    type: string;
    title: string;
    message: string;
    time: number;
}

interface SavedRect {
    win: WindowElement;
    left: string;
    top: string;
    width: string;
    height: string;
    transform?: string;
    zIndex?: string;
}

interface TiledRect {
    win: WindowElement;
    left: string;
    top: string;
    width: string;
    height: string;
}

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

const FEATURE_DEFAULTS = {
    gpuAcceleration: true,
    animations: true,
    particleExplosion: true,
    dock: true,
    topdock: true,
    clock: true,
    session: true,
    search: true,
    windowSwitcher: true,
    dockDragDrop: true,
    expose: true,
    xray: true,
    snap: true,
    grid: false,
    lockScreen: false,
    tiling: false,
    minimizedPreview: true,
    toastCenter: true,
} as const;

type FeatureFlag = keyof typeof FEATURE_DEFAULTS;

const PLACEMENTS = ['dock', 'topdock', 'hidden', 'both'] as const;
type AppPlacementValue = (typeof PLACEMENTS)[number];

/**
 * Zero-dependency desktop shell engine. Instantiate via `new Prestige(config)`
 * or `Prestige.create(config)`, then `init()`.
 */
export class Prestige implements DialogHost {
    public readonly config: PrestigeConfig;
    public readonly user: PrestigeConfig;
    public readonly root: Document | HTMLElement;
    private readonly _ownedRoot: HTMLElement | Document | null;
    private readonly _ownedNodes = new Set<Node>();
    private _listenerController: AbortController | null = null;
    private _destroyed = false;
    private _initialized = false;
    private _animationsEnabled = true;
    private _listeners: Record<string, Array<(payload: unknown) => void>> = Object.create(null);

    private readonly _gpuAcceleration: boolean = FEATURE_DEFAULTS.gpuAcceleration;
    private readonly _animations: boolean = FEATURE_DEFAULTS.animations;
    private readonly _particleExplosion: boolean = FEATURE_DEFAULTS.particleExplosion;
    private readonly _dock: boolean = FEATURE_DEFAULTS.dock;
    private readonly _topdock: boolean = FEATURE_DEFAULTS.topdock;
    private readonly _clock: boolean = FEATURE_DEFAULTS.clock;
    private readonly _session: boolean = FEATURE_DEFAULTS.session;
    private readonly _search: boolean = FEATURE_DEFAULTS.search;
    private readonly _windowSwitcher: boolean = FEATURE_DEFAULTS.windowSwitcher;
    private readonly _dockDragDrop: boolean = FEATURE_DEFAULTS.dockDragDrop;
    private readonly _expose: boolean = FEATURE_DEFAULTS.expose;
    private readonly _xray: boolean = FEATURE_DEFAULTS.xray;
    private readonly _snap: boolean = FEATURE_DEFAULTS.snap;
    private readonly _grid: boolean = FEATURE_DEFAULTS.grid;
    private readonly _lockScreen: boolean = FEATURE_DEFAULTS.lockScreen;
    private readonly _tiling: boolean = FEATURE_DEFAULTS.tiling;
    private readonly _minimizedPreview: boolean = FEATURE_DEFAULTS.minimizedPreview;
    private readonly _toastCenter: boolean = FEATURE_DEFAULTS.toastCenter;

    private readonly _wm: WindowManager;

    private _dragWasDrag = false;
    private _switcherEl: HTMLElement | null = null;
    private _switcherActive = false;
    private _switcherIndex = -1;
    private _searchEl: HTMLElement | null = null;
    private _searchEscListener: EventListener | null = null;
    private _xrayActive = false;
    private _exposeActive = false;
    private _exposeSavedRects: SavedRect[] = [];
    private _hotCornerCooldown = false;
    private _contentCache: Record<string, unknown> = Object.create(null);
    private _clockInterval: number | null = null;
    private _lockActive = false;
    private _lockInterval: number | null = null;
    private _toasts: ToastEntry[] | null = null;
    private _tileActive = false;
    private _tileSaved: TiledRect[] = [];
    private _previewWin: WindowElement | null = null;
    private _previewSection: string | null = null;
    private _previewOrigin: { left: string; top: string; width: string; height: string } | null = null;
    private _store: PrestigeStore | null = null;
    private _ctxMenuEl: HTMLElement | null = null;
    private _ctxMenuHandler: EventListener | null = null;
    private _ctxMenuKeyHandler: ((event: KeyboardEvent) => void) | null = null;
    private _ctxMenuPreviousFocus: HTMLElement | null = null;

    private readonly _DOCK_ORDER_KEY = 'prestige_dock_order';
    private readonly _TOPDOCK_ORDER_KEY = 'prestige_topdock_order';

    constructor(config: PrestigeConfig = {}) {
        const apps: Record<string, AppManifest> = Object.create(null);
        for (const appId of Object.keys(config.apps ?? {})) {
            assertSafeAppId(appId);
            const manifest = config.apps?.[appId];
            if (manifest) apps[appId] = Object.freeze(Object.assign(Object.create(null), manifest)) as AppManifest;
        }
        const security = Object.prototype.hasOwnProperty.call(config, 'security')
            ? this._validateSecurityConfig(config.security)
            : undefined;
        const safeConfig = Object.freeze(Object.assign(Object.create(null), config, { apps, security })) as PrestigeConfig;
        this.config = safeConfig;
        this.user = safeConfig;
        this.root = safeConfig.container ?? document;
        if (!this.root || typeof this.root.querySelector !== 'function') {
            throw new Error('Prestige config.container must be a Document or Element.');
        }
        this._ownedRoot = safeConfig.container ?? null;

        for (const key of Object.keys(FEATURE_DEFAULTS) as FeatureFlag[]) {
            const value = safeConfig[key];
            (this as unknown as Record<string, boolean>)[`_${key}`] = value === undefined ? FEATURE_DEFAULTS[key] : value;
        }

        this._wm = new WindowManager(this);
    }

    /**
     * Validate the `security` options block at construction. Enforces the
     * "no fake crypto" rule (encryption requires an app-owned, persistable key)
     * and emits a loud `console.warn` for any option that weakens a secure
     * default.
     */
    private _validateSecurityConfig(source: SecurityOptions | undefined): Readonly<SecurityOptions> | undefined {
        if (!source) return undefined;
        const KNOWN_KEYS = new Set(['sanitizer', 'storage', 'storageKeyProvider', 'postTargetOrigin', 'clickjackCheck']);
        const sec: Record<string, unknown> = {};
        for (const key of Object.keys(source)) {
            if (KNOWN_KEYS.has(key)) sec[key] = (source as unknown as Record<string, unknown>)[key];
            else console.warn(`[Prestige] Unknown security option "${key}" ignored.`);
        }
        const validated = sec as SecurityOptions;

        if (validated.clickjackCheck === false) {
            console.warn('[Prestige] security.clickjackCheck is disabled — the web3 transaction guard will not verify visual safety before confirming.');
        }
        if (validated.storage === 'encrypted' && !validated.storageKeyProvider) {
            throw new Error('Prestige refuses security.storage="encrypted" without a security.storageKeyProvider. The library never generates a key that would be lost on reload — provide an app-owned key (e.g. PBKDF2-derived).');
        }
        if (validated.storageKeyProvider && validated.storage !== 'encrypted') {
            console.warn('[Prestige] security.storageKeyProvider is ignored unless security.storage is "encrypted".');
        }
        return Object.freeze(sec) as Readonly<SecurityOptions>;
    }

    /* ── Host surface (used by WindowManager / Dialogs) ───────── */

    public get animationsEnabled(): boolean {
        return this._animationsEnabled;
    }

    public _query(selector: string): Element | null {
        return this.root.querySelector(selector);
    }

    public _queryAll(selector: string): NodeListOf<Element> {
        return this.root.querySelectorAll(selector);
    }

    public _listen(
        target: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ): void {
        if (!this._listenerController) this._listenerController = new AbortController();
        let settings: AddEventListenerOptions;
        if (typeof options === 'boolean') {
            settings = { capture: options, signal: this._listenerController.signal };
        } else {
            settings = Object.assign({}, options ?? {}, { signal: this._listenerController.signal });
        }
        target.addEventListener(type, listener, settings);
    }

    public _mountNode(node: Node): Node {
        const doc = this.root instanceof Document ? this.root : null;
        const mount = this._ownedRoot ?? (doc ? doc.body : document.body);
        mount.appendChild(node);
        this._ownedNodes.add(node);
        return node;
    }

    public _unmountNode(node: Node | null): void {
        if (!node) return;
        if (node.parentNode) node.parentNode.removeChild(node);
        this._ownedNodes.delete(node);
    }

    /* ── Event emitter ────────────────────────────────────────── */

    public on(event: string, fn: (payload: unknown) => void): this {
        (this._listeners[event] ??= []).push(fn);
        return this;
    }

    public off(event: string, fn?: (payload: unknown) => void): this {
        const list = this._listeners[event];
        if (!list) return this;
        if (!fn) { delete this._listeners[event]; return this; }
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i] === fn) list.splice(i, 1);
        }
        return this;
    }

    public _emit(event: string, payload: unknown): void {
        const list = this._listeners[event];
        if (!list) return;
        for (const fn of list) {
            try { fn(payload); } catch (_e) { /* listener errors must not break the shell */ }
        }
    }

    /* ── Lifecycle ────────────────────────────────────────────── */

    public init(): this {
        if (this._destroyed) throw new Error('Cannot initialize a destroyed Prestige instance. Create a new instance instead.');
        if (this._initialized) return this;
        this._initialized = true;
        const html = document.documentElement;
        this._animationsEnabled = html.getAttribute('data-animations') !== 'false' && this._animations;

        if (!this._gpuAcceleration) html.setAttribute('data-gpu', 'false');
        if (this._grid) this._createGrid();
        this._applyInitialPlacements();
        if (this._dock) this.bindDock();
        if (this._topdock) this.bindTopDock();
        if (this._dock) this._setDataColors();
        if (this._dockDragDrop) {
            this._restoreDockOrder();
            this._restoreTopdockOrder();
            this._initDockDragDrop();
        }
        if (this._dock) this.bindDockScroll();
        this.bindCanvasClick();
        if (this._search || this._windowSwitcher || this._xray || this._expose || this._lockScreen || this._tiling || this._snap) this.bindKeyboard();
        if (this._clock) this.startClock();

        if (this._toastCenter) {
            const mbRight = this._query('.menubar-right');
            if (mbRight && !this._query('#toast-bell')) {
                const bell = $tag('button', { id: 'toast-bell', class: 'menubar-btn', title: 'Notifications' }, [$tag('i', { 'data-prestige-icon': 'bell' })]);
                bell.addEventListener('click', () => this._toggleToastCenter());
                mbRight.insertBefore(bell, mbRight.firstChild);
                renderIcons();
            }
        }

        if (this._expose) {
            this._listen(document, 'mousemove', ((e: MouseEvent) => { this.checkHotCorners(e); }) as EventListener);
        }

        if (this._dock) {
            const dockEl = this._query('#dock');
            this._listen(window, 'resize', (() => { this.updateDockScrollButtons(); }) as EventListener);
            this.updateDockScrollButtons();
            if (dockEl && this._minimizedPreview) {
                this._listen(dockEl, 'mouseover', ((e: MouseEvent) => {
                    const target = e.target as Element | null;
                    const btn = target ? target.closest<HTMLElement>('.dock-item.has-minimized') : null;
                    if (btn) this._showMinimizedPreview(btn, btn.getAttribute('data-section') ?? '');
                }) as EventListener, true);
                this._listen(dockEl, 'mouseleave', (() => { this._hideMinimizedPreview(); }) as EventListener);
            }
        }
        if (this._topdock) {
            const topdock = this._query('#topdock');
            if (topdock) {
                this._listen(topdock, 'mouseover', ((e: MouseEvent) => {
                    const target = e.target as Element | null;
                    const btn = target ? target.closest<HTMLElement>('.menubar-dock-item.has-minimized') : null;
                    if (btn) this._showMinimizedPreview(btn, btn.getAttribute('data-section') ?? '');
                }) as EventListener, true);
                this._listen(topdock, 'mouseleave', (() => { this._hideMinimizedPreview(); }) as EventListener);
            }
        }

        this._restoreSession();
        renderIcons(this.root);
        return this;
    }

    private _createGrid(): void {
        if (this._query('.desktop-grid')) return;
        const grid = document.createElement('div');
        grid.className = 'desktop-grid';
        (this._ownedRoot ?? document.body).appendChild(grid);
    }

    private _setDataColors(): void {
        this._queryAll('.dock-item[data-color]').forEach((el) => {
            const c = el.getAttribute('data-color');
            if (c && el instanceof HTMLElement) {
                el.style.setProperty('--c1', c);
                el.style.setProperty('--c2', c);
            }
        });
    }

    /* ── Dock bindings ────────────────────────────────────────── */

    public bindDock(): void {
        const dock = this._query('#dock');
        if (!dock) return;
        this._listen(dock, 'click', ((e: MouseEvent) => {
            if (this._dragWasDrag) { this._dragWasDrag = false; return; }
            const target = e.target as Element | null;
            const btn = target ? target.closest<HTMLElement>('.dock-item') : null;
            if (!btn) return;
            e.preventDefault();
            const section = btn.getAttribute('data-section');
            const icon = btn.getAttribute('data-icon');
            const label = btn.getAttribute('data-label') ?? section;
            if (!section) return;
            this.openWindow(section, icon ?? undefined, label ?? undefined, btn);
        }) as EventListener);
        this._listen(dock, 'dblclick', ((e: MouseEvent) => {
            const target = e.target as Element | null;
            const btn = target ? target.closest<HTMLElement>('.dock-item') : null;
            if (!btn) return;
            e.preventDefault();
            const section = btn.getAttribute('data-section');
            if (!section) return;
            const rec = this._wm.getOpenWindow(section);
            if (rec && rec.el && rec.el.isConnected) {
                this.closeWindow(rec.el);
                btn.classList.remove('has-minimized');
            }
        }) as EventListener);
        this._listen(dock, 'contextmenu', ((e: MouseEvent) => {
            const target = e.target as Element | null;
            const btn = target ? target.closest<HTMLElement>('.dock-item') : null;
            if (!btn) return;
            e.preventDefault();
            this._showDockPlacementMenu(btn, e.clientX, e.clientY);
        }) as EventListener);
    }

    public bindTopDock(): void {
        const topdock = this._query('#topdock');
        if (!topdock) return;
        this._listen(topdock, 'click', ((e: MouseEvent) => {
            const target = e.target as Element | null;
            const btn = target ? target.closest<HTMLElement>('.menubar-dock-item') : null;
            if (!btn) return;
            e.preventDefault();
            const section = btn.getAttribute('data-section');
            const icon = btn.getAttribute('data-icon');
            const label = btn.getAttribute('data-label') ?? section;
            if (!section) return;
            this.openWindow(section, icon ?? undefined, label ?? undefined, btn);
        }) as EventListener);
        this._listen(topdock, 'dblclick', ((e: MouseEvent) => {
            const target = e.target as Element | null;
            const btn = target ? target.closest<HTMLElement>('.menubar-dock-item') : null;
            if (!btn) return;
            e.preventDefault();
            const section = btn.getAttribute('data-section');
            if (!section) return;
            const rec = this._wm.getOpenWindow(section);
            if (rec && rec.el && rec.el.isConnected) {
                this.closeWindow(rec.el);
                btn.classList.remove('has-minimized');
            }
        }) as EventListener);
        this._listen(topdock, 'contextmenu', ((e: MouseEvent) => {
            const target = e.target as Element | null;
            const btn = target ? target.closest<HTMLElement>('.menubar-dock-item') : null;
            if (!btn) return;
            e.preventDefault();
            this._showDockPlacementMenu(btn, e.clientX, e.clientY);
        }) as EventListener);
    }

    private _saveDockOrder(): void {
        const order: string[] = [];
        this._queryAll('#dock .dock-item').forEach((btn) => {
            const s = btn.getAttribute('data-section');
            if (s) order.push(s);
        });
        try { localStorage.setItem(this._DOCK_ORDER_KEY, JSON.stringify(order)); } catch (error) { this._emit('storage:error', { key: this._DOCK_ORDER_KEY, error }); }
    }

    private _saveTopdockOrder(): void {
        const order: string[] = [];
        this._queryAll('#topdock .menubar-dock-item').forEach((btn) => {
            const s = btn.getAttribute('data-section');
            if (s) order.push(s);
        });
        try { localStorage.setItem(this._TOPDOCK_ORDER_KEY, JSON.stringify(order)); } catch (error) { this._emit('storage:error', { key: this._TOPDOCK_ORDER_KEY, error }); }
    }

    private _restoreOrder(key: string, selector: string, groupSelector: string): void {
        let raw: string | null = null;
        try { raw = localStorage.getItem(key); } catch (_e) { return; }
        if (!raw) return;
        let order: unknown;
        try { order = JSON.parse(raw); } catch (_e) { return; }
        if (!Array.isArray(order) || order.length === 0) return;
        const group = this._query(groupSelector);
        if (!group) return;
        const map: Record<string, HTMLElement> = Object.create(null);
        group.querySelectorAll<HTMLElement>(selector).forEach((btn) => {
            const s = btn.getAttribute('data-section');
            if (s) map[s] = btn;
        });
        const frag = document.createDocumentFragment();
        const seen: Record<string, boolean> = Object.create(null);
        for (const s of order as string[]) {
            const btn = map[s];
            if (btn && !seen[s]) { frag.appendChild(btn); seen[s] = true; }
        }
        group.querySelectorAll<HTMLElement>(selector).forEach((btn) => {
            const s = btn.getAttribute('data-section');
            if (s && !seen[s]) frag.appendChild(btn);
        });
        while (group.firstChild) group.removeChild(group.firstChild);
        group.appendChild(frag);
    }

    private _restoreDockOrder(): void {
        this._restoreOrder(this._DOCK_ORDER_KEY, '.dock-item', '#dock .dock-group');
    }

    private _restoreTopdockOrder(): void {
        this._restoreOrder(this._TOPDOCK_ORDER_KEY, '.menubar-dock-item', '#topdock');
    }

    private _initDockDragDrop(): void {
        const dock = this._query('#dock');
        const topdock = this._query('#topdock');
        const menubar = this._query('.menubar');
        if (!dock) return;
        let dragItem: HTMLElement | null = null;
        let dragSource: string | null = null;
        let dragActive = false;
        let startX = 0;
        let startY = 0;
        let dragGhost: HTMLElement | null = null;

        const getDropZone = (cx: number, cy: number): 'dock' | 'topdock' | null => {
            const t = 30;
            if (dock) {
                const dr = dock.getBoundingClientRect();
                if (cy >= dr.top - t && cy <= dr.bottom + t && cx >= dr.left - t && cx <= dr.right + t) return 'dock';
            }
            if (menubar) {
                const mr = menubar.getBoundingClientRect();
                if (cy >= mr.top && cy <= mr.bottom + t) return 'topdock';
            }
            return null;
        };

        const setZoneHighlight = (zone: 'dock' | 'topdock' | null): void => {
            dock?.classList.toggle('is-drop-target', zone === 'dock');
            menubar?.classList.toggle('is-drop-target', zone === 'topdock');
        };

        const getDropTarget = (cx: number, container: Element): { el: HTMLElement; before: boolean } | null => {
            const items = container.querySelectorAll<HTMLElement>('.dock-item');
            for (const item of items) {
                if (item === dragItem) continue;
                const r = item.getBoundingClientRect();
                if (cx >= r.left && cx <= r.right) {
                    return { el: item, before: cx < r.left + r.width / 2 };
                }
            }
            return null;
        };

        const getTopdockDropTarget = (cx: number): { el: HTMLElement; before: boolean } | null => {
            if (!topdock) return null;
            const items = topdock.querySelectorAll<HTMLElement>('.menubar-dock-item');
            for (const item of items) {
                if (item === dragItem) continue;
                const r = item.getBoundingClientRect();
                if (cx >= r.left && cx <= r.right) {
                    return { el: item, before: cx < r.left + r.width / 2 };
                }
            }
            return null;
        };

        const clearDragStyles = (): void => {
            dock?.querySelectorAll<HTMLElement>('.dock-item').forEach((el) => {
                el.classList.remove('is-dragging', 'drag-over', 'drag-over-left', 'drag-over-right');
            });
            dock?.classList.remove('is-dragging-active', 'is-drop-target');
            menubar?.classList.remove('is-drop-target');
            topdock?.querySelectorAll<HTMLElement>('.menubar-dock-item').forEach((el) => {
                el.classList.remove('is-dragging', 'drag-over');
            });
        };

        this._listen(document, 'mousedown', ((e: MouseEvent) => {
            if (e.button !== 0) return;
            const target = e.target as Element | null;
            const btn = target ? target.closest<HTMLElement>('.dock-item, .menubar-dock-item') : null;
            if (!btn) return;
            dragItem = btn;
            dragActive = false;
            startX = e.clientX;
            startY = e.clientY;
            dragSource = btn.classList.contains('dock-item') ? 'dock' : 'topdock';
        }) as EventListener);

        this._listen(document, 'mousemove', ((e: MouseEvent) => {
            if (!dragItem) return;
            if (!dragActive) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                if (dx * dx + dy * dy < 25) return;
                dragActive = true;
                dragItem.classList.add('is-dragging');
                dragGhost = this._createDragGhost(dragItem);
                if (dock && dragSource === 'dock') dock.classList.add('is-dragging-active');
            }
            if (dragGhost) {
                dragGhost.style.left = `${e.clientX}px`;
                dragGhost.style.top = `${e.clientY}px`;
            }
            const zone = getDropZone(e.clientX, e.clientY);
            setZoneHighlight(zone);
            dock?.querySelectorAll<HTMLElement>('.dock-item').forEach((el) => el.classList.remove('drag-over', 'drag-over-left', 'drag-over-right'));
            topdock?.querySelectorAll<HTMLElement>('.menubar-dock-item').forEach((el) => el.classList.remove('drag-over'));
            if (dragSource === 'dock' && zone === 'dock') {
                const t = getDropTarget(e.clientX, dock);
                if (t && t.el !== dragItem) {
                    t.el.classList.add('drag-over');
                    t.el.classList.add(t.before ? 'drag-over-left' : 'drag-over-right');
                }
            } else if (dragSource === 'topdock' && zone === 'topdock') {
                const t = getTopdockDropTarget(e.clientX);
                if (t && t.el !== dragItem) t.el.classList.add('drag-over');
            }
        }) as EventListener);

        this._listen(document, 'mouseup', ((e: MouseEvent) => {
            if (!dragItem) return;
            if (dragActive) {
                this._dragWasDrag = true;
                const section = dragItem.getAttribute('data-section');
                const zone = getDropZone(e.clientX, e.clientY);
                if (dragSource === 'dock' && zone === 'topdock') {
                    if (section) this.setAppPlacement(section, 'topdock');
                } else if (dragSource === 'topdock' && zone === 'dock') {
                    if (section) this.setAppPlacement(section, 'dock');
                } else if (dragSource === 'dock' && zone === 'dock') {
                    const t = getDropTarget(e.clientX, dock);
                    if (t && t.el !== dragItem) {
                        t.el.parentNode?.insertBefore(dragItem, t.before ? t.el : t.el.nextSibling);
                        this._saveDockOrder();
                        this.updateDockScrollButtons();
                    }
                } else if (dragSource === 'topdock' && zone === 'topdock') {
                    const t = getTopdockDropTarget(e.clientX);
                    if (t && t.el !== dragItem && topdock) {
                        topdock.insertBefore(dragItem, t.before ? t.el : t.el.nextSibling);
                        this._saveTopdockOrder();
                    }
                }
            }
            clearDragStyles();
            dragItem.classList.remove('is-dragging');
            this._removeDragGhost();
            dragItem = null;
            dragActive = false;
            dragSource = null;
        }) as EventListener);
    }

    private _createDragGhost(btn: HTMLElement): HTMLElement {
        this._removeDragGhost();
        const ghost = document.createElement('div');
        ghost.className = 'dock-drag-ghost';
        const icon = btn.querySelector('svg[data-prestige-icon], i[data-prestige-icon]');
        if (icon) {
            ghost.appendChild(icon.cloneNode(true));
            if (icon.tagName !== 'svg') renderIcons(ghost);
        } else {
            const fallback = $tag('i', { 'data-prestige-icon': 'circle' });
            ghost.appendChild(fallback);
            renderIcons(ghost);
        }
        (this._ownedRoot ?? document.body).appendChild(ghost);
        return ghost;
    }

    private _removeDragGhost(): void {
        document.querySelector('.dock-drag-ghost')?.remove();
    }

    public bindDockScroll(): void {
        this._queryAll('[data-dock-scroll]').forEach((btn) => {
            const dir = btn.getAttribute('data-dock-scroll');
            this._listen(btn, 'click', (() => {
                const dock = this._query('#dock');
                if (!dock) return;
                dock.scrollBy({ left: dir === 'left' ? -220 : 220, behavior: 'smooth' });
            }) as EventListener);
        });
        const dock = this._query('#dock');
        if (dock) this._listen(dock, 'scroll', (() => { this.updateDockScrollButtons(); }) as EventListener);
    }

    public updateDockScrollButtons(): void {
        const dock = this._query('#dock');
        if (!dock) return;
        const left = this._query('[data-dock-scroll="left"]');
        const right = this._query('[data-dock-scroll="right"]');
        if (!left || !right) return;
        const maxScroll = dock.scrollWidth - dock.clientWidth;
        if (maxScroll <= 4) { left.classList.remove('is-visible'); right.classList.remove('is-visible'); return; }
        left.classList.toggle('is-visible', dock.scrollLeft > 4);
        right.classList.toggle('is-visible', dock.scrollLeft < maxScroll - 4);
    }

    public bindCanvasClick(): void {
        const canvas = this._query('#desktop-canvas');
        if (!canvas) return;
        this._listen(canvas, 'mousedown', ((e: MouseEvent) => {
            const target = e.target as Element | null;
            if (target && target.closest('.window')) return;
            this._queryAll('.window.is-focused').forEach((w) => {
                this._emit('window:blur', { win: w });
                w.classList.remove('is-focused');
            });
            const titleEl = this._query('#active-window-title');
            if (titleEl) titleEl.textContent = 'No windows open';
        }) as EventListener);
        this._listen(canvas, 'dblclick', ((e: MouseEvent) => {
            const target = e.target as Element | null;
            if (target && target.closest('.window')) return;
            this.closeAllWindows();
        }) as EventListener);
    }

    /* ── Keyboard shortcuts ───────────────────────────────────── */

    public bindKeyboard(): void {
        if (this._xray) this._listen(window, 'blur', (() => { this.disableXRay(); }) as EventListener);
        this._listen(document, 'keydown', ((e: KeyboardEvent) => {
            const target = e.target as Element | null;
            const tag = target ? target.tagName : '';
            const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (target instanceof HTMLElement && target.isContentEditable);
            if (this._xray && e.altKey && (e.code === 'KeyX' || e.key === 'x' || e.key === 'X') && !e.repeat) {
                if (!isTyping) { e.preventDefault(); this.enableXRay(); return; }
            }
            if (this._search && (e.ctrlKey || e.metaKey) && e.code === 'Space') {
                e.preventDefault(); this.showSearch(); return;
            }
            if (this._windowSwitcher && (e.ctrlKey || e.metaKey) && !e.altKey && !isTyping && (e.code === 'Backquote' || e.key === '`')) {
                e.preventDefault();
                const windows = this._wm._getSwitcherWindows();
                if (windows.length < 2) return;
                if (!this._switcherActive) { this._switcherActive = true; this._showSwitcher(windows); }
                const dir = e.shiftKey ? -1 : 1;
                this._switcherIndex = (this._switcherIndex + dir + windows.length) % windows.length;
                this._highlightSwitcher(this._switcherIndex);
            }
            if (e.key === 'Escape') {
                if (this._expose && this._exposeActive) { e.preventDefault(); this.toggleExpose(false); return; }
                if (this._xray && this._xrayActive) { this.disableXRay(); return; }
                if (this._windowSwitcher && this._switcherActive) { e.preventDefault(); this._hideSwitcher(); this._switcherActive = false; this._switcherIndex = -1; }
            }
            if (this._lockScreen && e.key === 'l' && (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && !isTyping) {
                e.preventDefault(); this.lock(); return;
            }
            if (this._tiling && e.key === 't' && (e.ctrlKey || e.metaKey) && e.altKey && !isTyping) {
                e.preventDefault(); this._tileWindows(); return;
            }
            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && !isTyping) {
                const focused = this._getFocusedWindow();
                if (focused) {
                    if (e.key === 'ArrowLeft' && this._snap) { e.preventDefault(); this._wm._applySnapOnRelease(focused, 'left'); return; }
                    if (e.key === 'ArrowRight' && this._snap) { e.preventDefault(); this._wm._applySnapOnRelease(focused, 'right'); return; }
                }
            }
            if (this._windowSwitcher && (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && !isTyping && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                const windows = this._wm._getSwitcherWindows();
                if (windows.length > 1) {
                    const focused = this._getFocusedWindow();
                    if (focused !== null) {
                        const idx = windows.indexOf(focused);
                        const next = idx >= 0 ? (idx + (e.key === 'ArrowRight' ? 1 : -1) + windows.length) % windows.length : 0;
                        this.focusWindow(windows[next]);
                    }
                }
                return;
            }
        }) as EventListener);
        this._listen(document, 'keyup', ((e: KeyboardEvent) => {
            if (this._xray && (e.key === 'Alt' || e.code === 'KeyX' || e.key === 'x' || e.key === 'X')) this.disableXRay();
            if (this._windowSwitcher && !e.ctrlKey && !e.metaKey && this._switcherActive) {
                const windows = this._wm._getSwitcherWindows();
                const idx = this._switcherIndex >= 0 ? this._switcherIndex : 0;
                if (windows[idx]) this.focusWindow(windows[idx]);
                this._hideSwitcher();
                this._switcherActive = false;
                this._switcherIndex = -1;
            }
        }) as EventListener);
    }

    /* ── X-Ray ────────────────────────────────────────────────── */

    public enableXRay(): void {
        if (this._xrayActive) return;
        this._xrayActive = true;
        this._emit('xray:enable', {});
        this._queryAll('.window').forEach((win) => {
            if (!win.classList.contains('is-focused')) win.classList.add('is-xray-dimmed');
        });
    }

    public disableXRay(): void {
        if (!this._xrayActive) return;
        this._xrayActive = false;
        this._emit('xray:disable', {});
        this._queryAll('.window.is-xray-dimmed').forEach((win) => win.classList.remove('is-xray-dimmed'));
    }

    public peekXRay(): void {
        if (this._xrayActive) this.disableXRay();
        else this.enableXRay();
    }

    /* ── Exposé / hot corners ─────────────────────────────────── */

    public checkHotCorners(e: MouseEvent): void {
        if (this._exposeActive || this._hotCornerCooldown) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const hit =
            (e.clientX <= 12 && e.clientY <= 12) ||
            (e.clientX >= w - 12 && e.clientY <= 12) ||
            (e.clientX <= 12 && e.clientY >= h - 12) ||
            (e.clientX >= w - 12 && e.clientY >= h - 12);
        if (hit) {
            this._hotCornerCooldown = true;
            this.toggleExpose(true);
            window.setTimeout(() => { this._hotCornerCooldown = false; }, 1200);
        }
    }

    public toggleExpose(enable?: boolean): void {
        if (enable === undefined) enable = !this._exposeActive;
        if (enable && this._exposeActive) return;
        if (!enable && !this._exposeActive) return;
        const visibleWins = this._wm._getSwitcherWindows();
        if (enable && visibleWins.length === 0) return;
        const canvas = this._query('#desktop-canvas');
        if (!canvas) return;
        if (enable) {
            this._exposeActive = true;
            this._emit('expose:open', {});
            this._exposeSavedRects = [];
            const backdrop = $tag('div', { id: 'expose-backdrop', class: 'expose-backdrop' });
            canvas.appendChild(backdrop);
            const bounds = this._wm.getSafeBounds();
            const total = visibleWins.length;
            const cols = Math.ceil(Math.sqrt(total));
            const rows = Math.ceil(total / cols);
            const canvasW = canvas.clientWidth;
            const canvasH = bounds.bottom - bounds.top;
            const gap = 24;
            const cellW = (canvasW - gap * (cols + 1)) / cols;
            const cellH = (canvasH - gap * (rows + 1)) / rows;
            visibleWins.forEach((win, idx) => {
                this._exposeSavedRects.push({
                    win,
                    left: win.style.left,
                    top: win.style.top,
                    width: win.style.width,
                    height: win.style.height,
                    transform: win.style.transform,
                    zIndex: win.style.zIndex,
                });
                const r = Math.floor(idx / cols);
                const c = idx % cols;
                win.classList.add('is-in-expose');
                win.style.transition = 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
                win.style.left = `${gap + c * (cellW + gap)}px`;
                win.style.top = `${bounds.top + gap + r * (cellH + gap)}px`;
                win.style.width = `${cellW}px`;
                win.style.height = `${cellH}px`;
                const onClick = (event: Event): void => {
                    event.stopPropagation();
                    event.preventDefault();
                    this.focusWindow(win);
                    this.toggleExpose(false);
                };
                win._exposeClickHandler = onClick;
                win.addEventListener('click', onClick, true);
            });
            backdrop.addEventListener('click', () => this.toggleExpose(false));
        } else {
            this._exposeActive = false;
            this._emit('expose:close', {});
            this._unmountNode(this._query('#expose-backdrop'));
            this._exposeSavedRects.forEach((item) => {
                const win = item.win;
                win.classList.remove('is-in-expose');
                win.style.transition = 'all 0.3s ease';
                win.style.left = item.left;
                win.style.top = item.top;
                win.style.width = item.width;
                win.style.height = item.height;
                win.style.transform = item.transform ?? '';
                if (win._exposeClickHandler) {
                    win.removeEventListener('click', win._exposeClickHandler, true);
                    delete win._exposeClickHandler;
                }
                window.setTimeout(() => {
                    if (!win.classList.contains('is-in-expose')) win.style.transition = '';
                }, 300);
            });
            this._exposeSavedRects = [];
        }
    }

    /* ── Close all / particle explosion ───────────────────────── */

    private _removeAllWindows(suppressSessionSave: boolean): void {
        for (const section of this._wm.getOpenWindowKeys()) {
            const rec = this._wm.getOpenWindow(section);
            if (rec) this._wm.removeWindowRecord(rec, true);
        }
        if (!suppressSessionSave) this._saveSession();
    }

    public closeAllWindows(): void {
        if (this._animationsEnabled && this._particleExplosion) {
            this.explodeAndCloseAll();
        } else {
            this._removeAllWindows(false);
        }
    }

    public explodeAndCloseAll(): void {
        if (!this._animationsEnabled) {
            this._removeAllWindows(false);
            return;
        }
        const entries: Array<{ section: string; rec: WindowRecord }> = [];
        for (const section of this._wm.getOpenWindowKeys()) {
            const rec = this._wm.getOpenWindow(section);
            if (rec && rec.el && rec.el.parentNode && !this._wm.isMinimized(rec)) entries.push({ section, rec });
        }
        if (entries.length === 0) {
            this._removeAllWindows(false);
            return;
        }
        let canvas = this._query('#explosion-canvas') as HTMLCanvasElement | null;
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'explosion-canvas';
            canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99999;';
            (this._ownedRoot ?? document.body).appendChild(canvas);
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            canvas.remove();
            this._removeAllWindows(false);
            return;
        }
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const focalLength = 380;
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--prestige-accent').trim() || '#fbe482';
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--prestige-text').trim() || '#000000';
        const colors = [accent, textColor, accent, textColor, accent, textColor];
        interface Particle {
            x: number; y: number; z: number;
            vx: number; vy: number; vz: number;
            size: number; color: string; alpha: number; decay: number; gravity: number;
        }
        const particles: Particle[] = [];
        let pendingRemovals = entries.length;
        entries.forEach(({ rec }) => {
            const win = rec.el;
            const rect = win.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const cols = 32;
            const rows = 24;
            const cellW = rect.width / cols;
            const cellH = rect.height / rows;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const px = rect.left + c * cellW + cellW / 2;
                    const py = rect.top + r * cellH + cellH / 2;
                    const angle = Math.atan2(py - centerY, px - centerX) + (Math.random() - 0.5) * 0.5;
                    const speed = 4 + Math.random() * 10;
                    particles.push({
                        x: px, y: py, z: (Math.random() - 0.5) * 30,
                        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 3,
                        vy: Math.sin(angle) * speed - (1 + Math.random() * 5),
                        vz: (Math.random() - 0.5) * 16,
                        size: 0.4 + Math.random() * 0.8,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        alpha: 1.0,
                        decay: 0.016 + Math.random() * 0.018,
                        gravity: 0.26,
                    });
                }
            }
            win.style.opacity = '0';
            win.style.transform = 'scale(0.88)';
            win.style.transition = 'opacity 0.08s ease, transform 0.08s ease';
            if (rec.btn) rec.btn.classList.remove('is-open', 'has-minimized');
            win._disposal?.setTimeout(() => {
                this._wm.removeWindowRecord(rec, true);
                pendingRemovals -= 1;
                if (pendingRemovals === 0) this._saveSession();
            }, 80);
        });
        for (const sec of this._wm.getOpenWindowKeys()) {
            const rec = this._wm.getOpenWindow(sec);
            if (rec && rec.el && rec.el.parentNode && this._wm.isMinimized(rec)) {
                this._wm.removeWindowRecord(rec, true);
            }
        }
        const renderLoop = (): void => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let activeCount = 0;
            const batch: Record<string, Array<{ x: number; y: number; r: number; a: number }>> = {};
            for (const p of particles) {
                if (p.alpha <= 0) continue;
                activeCount += 1;
                p.x += p.vx; p.y += p.vy; p.z += p.vz;
                p.vy += p.gravity;
                p.vx *= 0.97; p.vy *= 0.97; p.vz *= 0.97;
                p.alpha -= p.decay;
                const scale = focalLength / (focalLength + p.z);
                if (scale <= 0) continue;
                const projX = (p.x - canvas.width / 2) * scale + canvas.width / 2;
                const projY = (p.y - canvas.height / 2) * scale + canvas.height / 2;
                const projSize = Math.max(0.3, p.size * scale);
                if (p.alpha > 0) {
                    (batch[p.color] ??= []).push({ x: projX, y: projY, r: projSize, a: Math.max(0, p.alpha) });
                }
            }
            for (const color of Object.keys(batch)) {
                ctx.fillStyle = color;
                for (const d of batch[color]) {
                    ctx.globalAlpha = d.a;
                    ctx.beginPath();
                    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
            if (activeCount > 0) requestAnimationFrame(renderLoop);
            else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.remove(); }
        };
        requestAnimationFrame(renderLoop);
    }

    /* ── Tiling ───────────────────────────────────────────────── */

    private _tileWindows(): void {
        if (this._tileActive) { this._untileWindows(); return; }
        const visible = this._wm._getSwitcherWindows();
        if (visible.length < 2) return;
        const canvas = this._query('#desktop-canvas');
        if (!canvas) return;
        const bounds = this._wm.getSafeBounds();
        const canvasW = canvas.clientWidth;
        const canvasH = bounds.bottom - bounds.top;
        const gap = 6;
        const total = visible.length;
        const cols = Math.ceil(Math.sqrt(total));
        const rows = Math.ceil(total / cols);
        const cellW = (canvasW - gap * (cols + 1)) / cols;
        const cellH = (canvasH - gap * (rows + 1)) / rows;
        if (cellW < 420 || cellH < 280) return;
        this._tileActive = true;
        this._tileSaved = [];
        visible.forEach((win, idx) => {
            this._tileSaved.push({ win, left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height });
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            win.classList.remove('is-zoomed', 'is-snapped');
            this._wm.setWindowLogicalState(win, undefined, false);
            win.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
            win.style.left = `${gap + c * (cellW + gap)}px`;
            win.style.top = `${bounds.top + gap + r * (cellH + gap)}px`;
            win.style.width = `${cellW}px`;
            win.style.height = `${cellH}px`;
        });
        this._emit('tiling:enable', {});
    }

    private _untileWindows(): void {
        if (!this._tileActive) return;
        this._tileActive = false;
        this._tileSaved.forEach((item) => {
            const win = item.win;
            if (!win || !win.isConnected) return;
            win.style.transition = 'all 0.25s ease';
            win.style.left = item.left;
            win.style.top = item.top;
            win.style.width = item.width;
            win.style.height = item.height;
            window.setTimeout(() => {
                if (win && win.isConnected) win.style.transition = '';
            }, 250);
        });
        this._tileSaved = [];
        this._emit('tiling:disable', {});
    }

    /* ── Minimized preview ────────────────────────────────────── */

    private _showMinimizedPreview(btn: HTMLElement, section: string): void {
        if (!this._minimizedPreview) return;
        if (this._previewSection === section) return;
        this._hideMinimizedPreview();
        const rec = this._wm.getOpenWindow(section);
        if (!rec || !rec.el || !this._wm.isMinimized(rec)) return;
        const win = rec.el;
        this._previewOrigin = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
        win.classList.remove('is-minimized', 'is-gone');
        win.classList.add('is-preview');
        const btnRect = btn.getBoundingClientRect();
        const isTopdock = btn.classList.contains('menubar-dock-item');
        const scale = 0.28;
        const winW = parseFloat(win.style.width) || 760;
        const winH = parseFloat(win.style.height) || 540;
        let left = btnRect.left + btnRect.width / 2 - winW / 2;
        if (left < 10) left = 10;
        const top = isTopdock ? btnRect.bottom + 10 : btnRect.top - winH * scale - 10;
        win.style.left = `${left}px`;
        win.style.top = `${Math.max(10, top)}px`;
        win.style.width = `${winW}px`;
        win.style.height = `${winH}px`;
        this._previewWin = win;
        this._previewSection = section;
    }

    private _hideMinimizedPreview(): void {
        if (!this._previewWin) return;
        const win = this._previewWin;
        const section = win.getAttribute('data-section') ?? '';
        if (this._previewOrigin) {
            win.style.left = this._previewOrigin.left;
            win.style.top = this._previewOrigin.top;
            win.style.width = this._previewOrigin.width;
            win.style.height = this._previewOrigin.height;
        }
        this._previewOrigin = null;
        win.classList.remove('is-preview');
        const rec = this._wm.getOpenWindow(section);
        if (rec && rec.el === win && this._wm.isMinimized(rec)) win.classList.add('is-minimized', 'is-gone');
        this._previewWin = null;
        this._previewSection = null;
    }

    /* ── Toast / notification center ──────────────────────────── */

    public notify(type: 'info' | 'success' | 'warning' | 'error', title: string, message?: string): void {
        if (!this._toastCenter) return;
        this._toasts ??= [];
        this._toasts.unshift({ type, title: title ?? '', message: message ?? '', time: Date.now() });
        if (this._toasts.length > 50) this._toasts.length = 50;
        this._renderToastCenter();
    }

    private _toggleToastCenter(): void {
        const el = this._query('#toast-center');
        if (el) {
            el.classList.toggle('is-open');
            if (el.classList.contains('is-open')) this._renderToastCenter();
        } else {
            this._createToastCenter();
            this._renderToastCenter();
        }
    }

    private _createToastCenter(): void {
        this._unmountNode(this._query('#toast-center'));
        const el = $tag('div', { id: 'toast-center', class: 'toast-center', role: 'region', 'aria-label': 'Notifications' });
        const header = $tag('div', { class: 'toast-center-header' });
        header.append($tag('span', {}, [$text('Notifications')]), $tag('button', { class: 'toast-center-clear', id: 'toast-clear-all' }, [$text('Clear all')]));
        const list = $tag('div', { class: 'toast-center-list', id: 'toast-center-list', 'aria-live': 'polite' });
        el.append(header, list);
        this._mountNode(el);
        el.addEventListener('click', ((e: MouseEvent) => {
            const target = e.target as Element | null;
            const item = target ? target.closest<HTMLElement>('.toast-item') : null;
            if (item && item.dataset && item.dataset.idx !== undefined) {
                this._toasts?.splice(parseInt(item.dataset.idx, 10), 1);
                this._renderToastCenter();
            }
        }) as EventListener);
        el.querySelector('#toast-clear-all')?.addEventListener('click', () => { this._toasts = []; this._renderToastCenter(); });
        window.setTimeout(() => el.classList.add('is-open'), 10);
        this._listen(document, 'click', ((e: Event) => {
            if (!el.classList.contains('is-open')) return;
            const target = e.target as Node | null;
            if (target && el.contains(target)) return;
            if (target instanceof Element && target.closest('#toast-bell')) return;
            el.classList.remove('is-open');
        }) as EventListener);
    }

    private _renderToastCenter(): void {
        const list = this._query('#toast-center-list');
        if (!list) return;
        while (list.firstChild) list.removeChild(list.firstChild);
        if (!this._toasts || this._toasts.length === 0) {
            list.appendChild($tag('div', { class: 'toast-center-empty' }, [$text('No notifications yet')]));
            return;
        }
        const icons: Record<string, string> = { info: '\u2139', success: '\u2713', warning: '\u26A0', error: '\u2716' };
        this._toasts.forEach((t, i) => {
            const item = $tag('div', { class: 'toast-item', 'data-idx': String(i) });
            item.append(
                $tag('div', { class: `toast-item-icon is-${t.type}` }, [$text(icons[t.type] ?? '\u2139')]),
                $tag('div', { class: 'toast-item-body' }, [
                    $tag('div', { class: 'toast-item-title' }, [$text(t.title)]),
                    $tag('div', { class: 'toast-item-msg' }, [$text(t.message)]),
                    $tag('div', { class: 'toast-item-time' }, [$text(this._timeAgo(t.time))]),
                ]),
                $tag('button', { class: 'toast-item-dismiss', 'data-idx': String(i), 'aria-label': `Dismiss notification: ${t.title}` }, [$text('×')]),
            );
            list.appendChild(item);
        });
    }

    private _timeAgo(ts: number): string {
        const sec = Math.floor((Date.now() - ts) / 1000);
        if (sec < 60) return 'just now';
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m ago`;
        const hrs = Math.floor(min / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }

    /* ── App registration & placement ─────────────────────────── */

    public registerApp(appId: string, manifest: Partial<AppManifest>): this {
        if (typeof appId !== 'string') throw new Error('Prestige app IDs must be strings.');
        assertSafeAppId(appId);
        const apps = this.config.apps as Record<string, AppManifest>;
        const previous = Object.prototype.hasOwnProperty.call(apps, appId) ? apps[appId] : undefined;
        apps[appId] = Object.freeze(Object.assign(Object.create(null), previous ?? {}, manifest)) as AppManifest;
        const placement = this._getAppPlacement(appId);
        this._setAppPlacement(appId, placement, false);
        renderIcons(this.root);
        this._emit('app:register', { appId, manifest });
        return this;
    }

    private _applyInitialPlacements(): void {
        const configuredIds = new Set(Object.keys(this.config.apps ?? {}));
        const appIds = new Set(configuredIds);
        this._queryAll('.dock-item[data-section], .menubar-dock-item[data-section]').forEach((el) => {
            const appId = el.getAttribute('data-section');
            if (appId) appIds.add(appId);
        });
        for (const appId of appIds) {
            try {
                assertSafeAppId(appId);
                const override = this._getPersistedPlacement(appId);
                if (configuredIds.has(appId) || override) this._setAppPlacement(appId, override ?? this._getAppPlacement(appId), false);
            } catch (_e) { /* ignore malformed host markup */ }
        }
    }

    private _buildDockItem(appId: string, manifest: Partial<AppManifest>): HTMLElement {
        const el = document.createElement('button');
        el.className = 'dock-item';
        el.setAttribute('data-section', appId);
        el.setAttribute('data-app-id', appId);
        el.setAttribute('data-label', manifest.title ?? manifest.label ?? appId);
        el.setAttribute('data-icon', manifest.icon ?? '');
        if (manifest.c1) { el.setAttribute('data-color', manifest.c1); el.style.setProperty('--c1', manifest.c1); }
        if (manifest.c2) el.style.setProperty('--c2', manifest.c2);
        el.append(
            $tag('span', { class: 'dock-icon' }, [$tag('i', { 'data-prestige-icon': manifest.icon ?? 'circle' })]),
            $tag('span', { class: 'dock-label' }, [$text(manifest.title ?? manifest.label ?? appId)]),
            $tag('span', { class: 'dock-dot' }),
        );
        return el;
    }

    private _readAppMeta(appId: string): { icon: string; label: string; c1: string; c2: string } {
        const meta = { icon: '', label: '', c1: '', c2: '' };
        const el = this._query(`[data-section="${appId}"].dock-item`) ?? this._query(`[data-section="${appId}"].menubar-dock-item`);
        if (el) {
            meta.icon = el.getAttribute('data-icon') ?? '';
            meta.label = el.getAttribute('data-label') ?? appId;
            meta.c1 = el.getAttribute('data-color') ?? '';
        }
        const apps = this.config.apps;
        const manifest = apps && Object.prototype.hasOwnProperty.call(apps, appId) ? apps[appId] : undefined;
        if (manifest) {
            if (manifest.icon) meta.icon = manifest.icon;
            meta.label = manifest.title ?? manifest.label ?? meta.label ?? appId;
            if (manifest.c1) meta.c1 = manifest.c1;
            if (manifest.c2) meta.c2 = manifest.c2;
        }
        return meta;
    }

    public setAppPlacement(appId: string, placement: AppPlacementValue): this {
        return this._setAppPlacement(appId, placement, true);
    }

    /** Reset an app to its manifest-declared placement (clears the persisted override). */
    public resetAppPlacement(appId: string): this {
        try {
            const saved = JSON.parse(localStorage.getItem('prestige_placements') ?? '{}') as Record<string, string>;
            delete saved[appId];
            localStorage.setItem('prestige_placements', JSON.stringify(saved));
        } catch (error) { this._emit('storage:error', { key: 'prestige_placements', error }); }
        const apps = this.config.apps;
        const manifest = apps && Object.prototype.hasOwnProperty.call(apps, appId) ? apps[appId] : undefined;
        return this._setAppPlacement(appId, manifest?.placement ?? 'dock', false);
    }

    /** Internal placement application. Persists the override only when `persist` is set. */
    private _setAppPlacement(appId: string, placement: AppPlacementValue, persist: boolean): this {
        if (typeof appId !== 'string') throw new Error('Prestige app IDs must be strings.');
        assertSafeAppId(appId);
        if (!PLACEMENTS.includes(placement)) throw new Error('Invalid Prestige app placement.');
        if (persist) {
            try {
                const saved = JSON.parse(localStorage.getItem('prestige_placements') ?? '{}') as Record<string, string>;
                saved[appId] = placement;
                localStorage.setItem('prestige_placements', JSON.stringify(saved));
            } catch (error) { this._emit('storage:error', { key: 'prestige_placements', error }); }
        }
        const meta = this._readAppMeta(appId);
        const dock = this._query('#dock');
        const mb = this._query('.menubar');
        const escapedId = CSS.escape(appId);
        dock?.querySelector(`[data-section="${escapedId}"]`)?.remove();
        mb?.querySelector(`[data-section="${escapedId}"].menubar-dock-item`)?.remove();
        if (placement === 'dock' || placement === 'both') {
            this._appendToDock(this._buildDockItem(appId, { icon: meta.icon, label: meta.label, c1: meta.c1, c2: meta.c2 }));
        }
        if (placement === 'topdock' || placement === 'both') {
            this._addTopdockItem(appId, meta);
        }
        const rec = this._wm.getOpenWindow(appId);
        if (rec) {
            rec.btn = (this._query(`.dock-item[data-section="${escapedId}"]`) ?? this._query(`.menubar-dock-item[data-section="${escapedId}"]`)) as HTMLElement | null;
            rec.btn?.classList.add('is-open');
            rec.btn?.classList.toggle('has-minimized', this._wm.isMinimized(rec));
        }
        renderIcons(this.root);
        this._emit('placement:changed', { appId, placement });
        return this;
    }

    /** Resolve an app's effective placement: persisted override, then manifest, then 'dock'. */
    private _getAppPlacement(appId: string): AppPlacementValue {
        const override = this._getPersistedPlacement(appId);
        if (override) return override;
        const apps = this.config.apps;
        const manifest = apps && Object.prototype.hasOwnProperty.call(apps, appId) ? apps[appId] : undefined;
        const placement = manifest?.placement ?? 'dock';
        return PLACEMENTS.includes(placement) ? placement : 'dock';
    }

    private _getPersistedPlacement(appId: string): AppPlacementValue | null {
        try {
            const saved = JSON.parse(localStorage.getItem('prestige_placements') ?? '{}') as Record<string, string>;
            if (Object.prototype.hasOwnProperty.call(saved, appId) && PLACEMENTS.includes(saved[appId] as AppPlacementValue)) {
                return saved[appId] as AppPlacementValue;
            }
        } catch (_e) { /* corrupt storage — fall through to manifest default */ }
        return null;
    }

    /** Right-click placement menu for dock / topdock items (change or reset placement). */
    private _showDockPlacementMenu(btn: HTMLElement, x: number, y: number): void {
        const section = btn.getAttribute('data-section');
        if (!section) return;
        const current = this._getAppPlacement(section);
        const placementItem = (value: AppPlacementValue, label: string): ContextMenuItem => ({
            label,
            checked: current === value,
            onclick: () => { this.setAppPlacement(section, value); },
        });
        this.showContextMenu({
            x,
            y,
            items: [
                placementItem('dock', 'Dock'),
                placementItem('topdock', 'Top Dock'),
                placementItem('hidden', 'Hidden'),
                { sep: true },
                { label: 'Reset to default', onclick: () => { this.resetAppPlacement(section); } },
            ],
        });
    }

    private _appendToDock(el: HTMLElement): void {
        const dock = this._query('#dock');
        if (!dock) return;
        const group = dock.querySelector('.dock-group');
        if (group) group.appendChild(el);
        else dock.appendChild(el);
    }

    private _addTopdockItem(appId: string, meta: { icon?: string; label?: string; c1?: string }): void {
        let topdock = this._query('#topdock');
        if (!topdock) {
            const mb = this._query('.menubar');
            if (!mb) return;
            topdock = document.createElement('div');
            topdock.className = 'menubar-center';
            topdock.id = 'topdock';
            const right = mb.querySelector('.menubar-right');
            if (right) mb.insertBefore(topdock, right);
            else mb.appendChild(topdock);
        }
        if (topdock.querySelector(`[data-section="${appId}"]`)) return;
        const el = document.createElement('button');
        el.className = 'menubar-dock-item';
        el.setAttribute('data-section', appId);
        el.setAttribute('data-app-id', appId);
        el.setAttribute('data-icon', meta.icon ?? '');
        el.setAttribute('data-label', meta.label ?? appId);
        if (meta.c1) el.setAttribute('data-color', meta.c1);
        el.title = meta.label ?? appId;
        el.appendChild($tag('i', { 'data-prestige-icon': meta.icon ?? 'circle' }));
        topdock.appendChild(el);
    }

    /* ── Window switcher ──────────────────────────────────────── */

    private _showSwitcher(windows: WindowElement[]): void {
        const overlay = $tag('div', { class: 'switcher-overlay' });
        overlay.addEventListener('click', () => { this._hideSwitcher(); this._switcherActive = false; this._switcherIndex = -1; });
        overlay.addEventListener('contextmenu', (e) => e.preventDefault());
        const panel = $tag('div', { class: 'switcher-panel' });
        windows.forEach((win, i) => {
            const card = $tag('div', { class: 'switcher-card', 'data-index': String(i) });
            const title = win.querySelector('.window-title');
            const labelText = title?.textContent?.trim() ?? win.getAttribute('data-section') ?? 'Window';
            const icon = win.querySelector('.window-title-icon');
            if (icon) {
                const wrap = $tag('span');
                wrap.style.display = 'inline-flex';
                wrap.style.marginRight = '8px';
                wrap.appendChild(icon.cloneNode(true));
                card.appendChild(wrap);
            }
            card.appendChild($tag('span', {}, [$text(labelText)]));
            const thumb = $tag('div', { class: 'switcher-thumb' });
            const contentClone = win.querySelector('.window-content-main');
            if (contentClone) {
                const clone = contentClone.cloneNode(true) as HTMLElement;
                clone.style.padding = '8px';
                clone.style.fontSize = '6px';
                clone.style.overflow = 'hidden';
                thumb.appendChild(clone);
            }
            card.appendChild(thumb);
            panel.appendChild(card);
        });
        overlay.appendChild(panel);
        this._mountNode(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));
        this._switcherEl = overlay;
    }

    private _highlightSwitcher(index: number): void {
        if (!this._switcherEl) return;
        const cards = this._switcherEl.querySelectorAll('.switcher-card');
        cards.forEach((c, i) => c.classList.toggle('is-selected', i === index));
        cards[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    private _hideSwitcher(): void {
        const el = this._switcherEl;
        if (el) {
            el.classList.remove('active');
            window.setTimeout(() => this._unmountNode(el), 180);
            this._switcherEl = null;
        }
    }

    /* ── Spotlight search ─────────────────────────────────────── */

    public showSearch(): void {
        if (this._searchEl) { (this._searchEl.querySelector('.search-input') as HTMLInputElement | null)?.focus(); return; }
        const overlay = $tag('div', { class: 'search-overlay' });
        const backdrop = $tag('div', { class: 'search-backdrop' });
        const dialog = $tag('div', { class: 'search-dialog' });
        const field = $tag('div', { class: 'search-field' });
        const input = $tag('input', { class: 'search-input', type: 'text', placeholder: 'Search pages, settings, fields\u2026', spellcheck: 'false', autofocus: true });
        const closeBtn = $tag('button', { class: 'search-close', title: 'Close search' }, [$text('×')]);
        const resultsEl = $tag('div', { class: 'search-results' });
        const footer = $tag('div', { class: 'search-footer' }, [
            $tag('span', {}, [$tag('kbd', {}, [$text('Esc')]), $text(' close')]),
            $tag('span', {}, [$tag('kbd', {}, [$text('↑')]), $tag('kbd', {}, [$text('↓')]), $text(' navigate')]),
            $tag('span', {}, [$tag('kbd', {}, [$text('↵')]), $text(' open')]),
        ]);
        field.append($tag('i', { 'data-prestige-icon': 'search', class: 'search-icon' }), input, closeBtn);
        dialog.append(field, resultsEl, footer);
        overlay.append(backdrop, dialog);
        this._mountNode(overlay);

        interface SearchItem { label: string; section: string; path: string; }
        const searchData: SearchItem[] = [];
        const apps = this.config.apps ?? {};
        for (const key of Object.keys(apps)) {
            searchData.push({ label: apps[key]?.label ?? key, section: key, path: `/${key}` });
        }
        this._queryAll('.dock-item[data-section], .menubar-dock-item[data-section]').forEach((el) => {
            const s = el.getAttribute('data-section');
            const l = el.getAttribute('data-label') ?? s ?? '';
            if (s && !searchData.some((d) => d.section === s)) {
                searchData.push({ label: l, section: s, path: `/${s}` });
            }
        });

        let lastResults: SearchItem[] = [];
        let selectedIndex = -1;

        const doSearch = (): void => {
            selectedIndex = -1;
            const q = input.value.trim().toLowerCase();
            if (!q) {
                replaceContent(resultsEl, $tag('div', { class: 'search-empty' }, [$text('Type to search\u2026')]), false, this.config.security?.sanitizer);
                lastResults = [];
                return;
            }
            const filtered = searchData.filter((item) => item.label.toLowerCase().includes(q) || item.section.includes(q));
            lastResults = filtered;
            while (resultsEl.firstChild) resultsEl.removeChild(resultsEl.firstChild);
            if (filtered.length === 0) {
                resultsEl.appendChild($tag('div', { class: 'search-empty' }, [$text('No results found')]));
                return;
            }
            resultsEl.appendChild($tag('div', { class: 'search-group-label' }, [$text('Pages')]));
            filtered.forEach((item, i) => {
                const row = $tag('div', { class: 'search-result', 'data-section': item.section });
                row.append(
                    $tag('span', { class: 'search-result-label' }, [$text(item.label)]),
                    $tag('span', { class: 'search-result-path' }, [$text(item.path)]),
                );
                row.addEventListener('click', () => this._searchNavigate(lastResults[i]));
                resultsEl.appendChild(row);
            });
            renderIcons(overlay);
        };

        let debounceTimer: number | null = null;
        input.addEventListener('input', () => {
            if (debounceTimer !== null) window.clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(doSearch, 150);
        });
        input.addEventListener('keydown', ((e: KeyboardEvent) => {
            const items = resultsEl.querySelectorAll('.search-result');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (items.length) {
                    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                    this._searchHighlight(items, selectedIndex);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (items.length) {
                    selectedIndex = Math.max(selectedIndex - 1, 0);
                    this._searchHighlight(items, selectedIndex);
                }
            } else if (e.key === 'Enter' && selectedIndex >= 0 && lastResults[selectedIndex]) {
                e.preventDefault();
                this._searchNavigate(lastResults[selectedIndex]);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this._closeSearch();
            }
        }) as EventListener);
        closeBtn.addEventListener('click', () => this._closeSearch());
        backdrop.addEventListener('click', () => this._closeSearch());
        this._searchEscListener = ((e: KeyboardEvent) => { if (e.key === 'Escape') this._closeSearch(); }) as EventListener;
        this._listen(document, 'keydown', this._searchEscListener);
        requestAnimationFrame(() => overlay.classList.add('active'));
        window.setTimeout(() => input.focus(), 100);
        this._searchEl = overlay;
        this._emit('search:open', {});
        replaceContent(resultsEl, $tag('div', { class: 'search-empty' }, [$text('Type to search\u2026')]), false, this.config.security?.sanitizer);
        renderIcons(overlay);
    }

    private _searchHighlight(items: NodeListOf<Element>, index: number): void {
        items.forEach((el, i) => el.classList.toggle('is-selected', i === index));
        items[index]?.scrollIntoView({ block: 'nearest' });
    }

    private _searchNavigate(result: { section: string; label: string }): void {
        this._closeSearch();
        const btn = this._query(`.dock-item[data-section="${CSS.escape(result.section)}"]`);
        const icon = btn instanceof HTMLElement ? (btn.getAttribute('data-icon') ?? undefined) : undefined;
        this.openWindow(result.section, icon, result.label, btn instanceof HTMLElement ? btn : null);
    }

    private _closeSearch(): void {
        const el = this._searchEl;
        if (el) {
            el.classList.remove('active');
            window.setTimeout(() => this._unmountNode(el), 200);
            this._searchEl = null;
        }
        if (this._searchEscListener) {
            document.removeEventListener('keydown', this._searchEscListener);
            this._searchEscListener = null;
        }
        this._emit('search:close', {});
    }

    /* ── Clock ────────────────────────────────────────────────── */

    public startClock(): void {
        const el = this._query('#menubar-clock');
        if (!el) return;
        const tick = (): void => {
            const d = new Date();
            el.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };
        tick();
        this._clockInterval = window.setInterval(tick, 30 * 1000);
    }

    /* ── Content cache ────────────────────────────────────────── */

    public cacheContent(key: string, value: unknown): void {
        this._contentCache[key] = value;
    }

    public getCachedContent(key: string): unknown {
        return this._contentCache[key] ?? null;
    }

    public clearContentCache(key?: string): void {
        if (key) delete this._contentCache[key];
        else this._contentCache = Object.create(null);
    }

    /* ── Session state ────────────────────────────────────────── */

    public getState(): WindowState[] {
        const out: WindowState[] = [];
        for (const id of this._wm.getOpenWindowKeys()) {
            const rec = this._wm.getOpenWindow(id);
            if (rec && rec.el) {
                out.push({
                    id,
                    x: parseFloat(rec.el.style.left) || 0,
                    y: parseFloat(rec.el.style.top) || 0,
                    w: parseFloat(rec.el.style.width) || 760,
                    h: parseFloat(rec.el.style.height) || 540,
                    minimized: this._wm.isMinimized(rec),
                    zoomed: this._wm.isZoomed(rec),
                    title: rec.label ?? '',
                    icon: rec.icon ?? '',
                } as WindowState & { icon: string });
            }
        }
        return out;
    }

    public setState(states: WindowState[]): void {
        if (!Array.isArray(states)) return;
        const normalized = states.map((state) => {
            if (!state || typeof state.id !== 'string') throw new Error('Prestige window state IDs must be strings.');
            const id = assertSafeAppId(state.id);
            const apps = this.config.apps;
            const manifest = apps && Object.prototype.hasOwnProperty.call(apps, id) ? apps[id] : undefined;
            const persisted = state as WindowState & { icon?: string };
            const meta = this._readAppMeta(id);
            return {
                state,
                id,
                icon: persisted.icon ?? manifest?.icon ?? meta.icon,
                title: state.title || manifest?.title || manifest?.label || meta.label || id,
            };
        });
        this._removeAllWindows(true);
        let lastVisible: WindowElement | null = null;
        for (const { state, id, icon, title } of normalized) {
            const trigger = this._query(`.dock-item[data-section="${CSS.escape(id)}"]`) ?? this._query(`.menubar-dock-item[data-section="${CSS.escape(id)}"]`);
            const win = this._wm.openWindow(id, icon || undefined, title, trigger instanceof HTMLElement ? trigger : null, {
                animate: false,
                focus: false,
                save: false,
                applyManifestMaximized: false,
            });
            if (win) {
                win.style.left = `${Number.isFinite(state.x) ? state.x : 0}px`;
                win.style.top = `${Number.isFinite(state.y) ? state.y : 0}px`;
                win.style.width = `${Number.isFinite(state.w) ? state.w : 760}px`;
                win.style.height = `${Number.isFinite(state.h) ? state.h : 540}px`;
                this._wm.setWindowLogicalState(win, state.minimized === true, state.zoomed === true);
                if (!state.minimized) lastVisible = win;
            }
        }
        if (lastVisible) this.focusWindow(lastVisible);
        this._saveSession();
    }

    public _saveSession(): void {
        if (!this._session) return;
        try {
            localStorage.setItem('prestige_session', JSON.stringify(this.getState()));
        } catch (error) { this._emit('storage:error', { key: 'prestige_session', error }); }
    }

    private _restoreSession(): void {
        if (!this._session) return;
        try {
            const raw = localStorage.getItem('prestige_session');
            if (!raw) return;
            const states = JSON.parse(raw) as WindowState[];
            if (Array.isArray(states) && states.length > 0) this.setState(states);
        } catch (_e) { /* corrupt session — ignore */ }
    }

    /* ── Lock screen ──────────────────────────────────────────── */

    public lock(): void {
        if (!this._lockScreen || this._lockActive) return;
        this._lockActive = true;
        this._unmountNode(this._query('#lock-screen'));
        const overlay = $tag('div', { class: 'lock-screen', id: 'lock-screen' });
        const now = new Date();
        overlay.append(
            $tag('div', { class: 'lock-clock', id: 'lock-clock' }, [$text(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))]),
            $tag('div', { class: 'lock-date' }, [$text(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }))]),
            $tag('input', { class: 'lock-input', id: 'lock-input', type: 'password', placeholder: 'Password', autocomplete: 'off' }),
            $tag('div', { class: 'lock-error', id: 'lock-error' }),
        );
        this._mountNode(overlay);
        this._lockInterval = window.setInterval(() => {
            const el = document.getElementById('lock-clock');
            if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }, 10000);
        const input = this._query('#lock-input');
        if (input) {
            window.setTimeout(() => (input as HTMLInputElement).focus(), 100);
            input.addEventListener('keydown', ((e: KeyboardEvent) => {
                if (e.key === 'Enter') this.unlock((input as HTMLInputElement).value);
            }) as EventListener);
        }
        this._emit('screen:lock', {});
    }

    public unlock(password: string): void {
        if (!this._lockActive) return;
        const expected = this.config.lockPassword ?? 'prestige';
        const errorEl = this._query('#lock-error');
        if (password !== expected) {
            if (errorEl instanceof HTMLElement) {
                errorEl.textContent = 'Incorrect password';
                errorEl.style.animation = 'lockShake 0.3s ease';
                window.setTimeout(() => {
                    if (errorEl instanceof HTMLElement) errorEl.style.animation = '';
                    const input = this._query('#lock-input');
                    if (input instanceof HTMLInputElement) { input.value = ''; input.focus(); }
                }, 300);
            }
            return;
        }
        this._unmountNode(this._query('#lock-screen'));
        if (this._lockInterval !== null) { window.clearInterval(this._lockInterval); this._lockInterval = null; }
        this._lockActive = false;
        this._emit('screen:unlock', {});
    }

    /* ── Store / URL sync ─────────────────────────────────────── */

    public get store(): PrestigeStore {
        if (!this._store) {
            const keyProvider = this.config.security?.storageKeyProvider;
            this._store = new PrestigeStore({
                storage: this.config.security?.storage ?? 'deny-secrets',
                ...(keyProvider ? { keyProvider } : {}),
            });
        }
        return this._store;
    }

    public syncUrlState(): string[] {
        const updateUrl = (): void => {
            const openIds = this._wm.getOpenWindowKeys().filter((sec) => {
                const rec = this._wm.getOpenWindow(sec);
                return rec && rec.el && !this._wm.isMinimized(rec);
            });
            const url = new URL(window.location.href);
            if (openIds.length > 0) url.searchParams.set('windows', openIds.join(','));
            else url.searchParams.delete('windows');
            window.history.replaceState({}, '', url.toString());
        };
        this.on('window:open', updateUrl);
        this.on('window:close', updateUrl);
        this.on('window:minimize', updateUrl);
        this.on('window:restore', updateUrl);
        const restored: string[] = [];
        const params = new URLSearchParams(window.location.search);
        const initialWindows = params.get('windows');
        if (initialWindows) {
            initialWindows.split(',').forEach((id) => {
                const cleanId = id.trim();
                const apps = this.config.apps;
                const app = apps && Object.prototype.hasOwnProperty.call(apps, cleanId) ? apps[cleanId] : undefined;
                if (!cleanId || !app) return;
                const trigger = this._query(`.dock-item[data-section="${CSS.escape(cleanId)}"]`);
                this.openWindow(cleanId, app.icon ?? '', app.title ?? app.label ?? cleanId, trigger instanceof HTMLElement ? trigger : null);
                restored.push(cleanId);
            });
        }
        return restored;
    }

    /* ── Window manager delegation ────────────────────────────── */

    public openWindow(section: string, icon?: string, label?: string, dockBtn?: HTMLElement | null): WindowElement | undefined {
        this._hideMinimizedPreview();
        return this._wm.openWindow(section, icon, label, dockBtn);
    }

    public closeWindow(win: WindowElement): void {
        this._wm.closeWindow(win);
    }

    public minimizeWindow(win: WindowElement): void {
        this._wm.minimizeWindow(win);
    }

    public restoreWindow(win: WindowElement): void {
        this._wm.restoreWindow(win);
    }

    public toggleMaximize(win: WindowElement): void {
        this._wm.toggleMaximize(win);
    }

    public focusWindow(win: WindowElement): void {
        this._wm.focusWindow(win);
    }

    public setWindowTitle(win: WindowElement, title: string): void {
        this._wm.setWindowTitle(win, title);
    }

    public setWindowContent(win: WindowElement, content: Node | string): void {
        this._wm.setWindowContent(win, content);
    }

    public getWindowContent(win: WindowElement): HTMLElement | null {
        return this._wm.getWindowContent(win);
    }

    public ownResource<T>(win: WindowElement, resource: T, disposer: (value: T) => void) {
        return this._wm.ownResource(win, resource, disposer);
    }

    public ownSocket(win: WindowElement, url: string, protocols?: string | string[]) {
        return this._wm.ownSocket(win, url, protocols);
    }

    public toggleBounce(section: string): void {
        this._wm.toggleBounce(section);
    }

    /* ── Dialog delegation (DialogHost) ───────────────────────── */

    public dialogShow(opts: DialogOptions): Promise<unknown> {
        return showDialogShow(this, opts);
    }

    public dialogInfo(o: string | DialogOptions = {}): Promise<true> {
        return showDialogInfo(this, o);
    }

    public dialogWarning(o: string | DialogOptions = {}): Promise<true> {
        return showDialogWarning(this, o);
    }

    public dialogDanger(o: string | DialogOptions = {}): Promise<true> {
        return showDialogDanger(this, o);
    }

    public dialogAlert(o: string | DialogOptions = {}): Promise<true> {
        return showDialogAlert(this, o);
    }

    public dialogConfirm(o: string | DialogOptions = {}): Promise<boolean> {
        return showDialogConfirm(this, o);
    }

    public dialogPrompt(o: string | DialogOptions = {}): Promise<string | null> {
        return showDialogPrompt(this, o);
    }

    public dialogSave(o: string | DialogOptions = {}): Promise<SaveDialogResult> {
        return showDialogSave(this, o);
    }

    public dialogOpen(o: string | DialogOptions = {}): Promise<FileList | null> {
        return showDialogOpen(this, o);
    }

    /* ── Toast / modal / drawer delegation ────────────────────── */

    public toast(message: unknown, type?: 'info' | 'success' | 'warning' | 'error', duration?: number): ToastApi {
        if (typeof message === 'object' && message !== null) {
            return createToast(message as ToastOptions, this);
        }
        const options: ToastOptions = { message };
        if (type !== undefined) options.type = type;
        if (duration !== undefined) options.duration = duration;
        return createToast(options, this);
    }

    public customModal(options: { title?: string; ariaLabel?: string; width?: number; body?: unknown; trustedHtml?: boolean; buttons?: Array<{ label?: string; variant?: 'primary' | 'success' | 'danger' | 'ghost'; value?: unknown; disabled?: boolean }>; closeOnEscape?: boolean; closeOnBackdrop?: boolean; closeValue?: unknown; onClose?: (value: unknown, reason?: string) => void }): Promise<unknown> {
        return createModal(options, this);
    }

    public drawer(options: { title?: string; side?: 'left' | 'right'; width?: number; content?: unknown; trustedHtml?: boolean; closeOnEscape?: boolean; closeOnBackdrop?: boolean; ariaLabel?: string; onClose?: (reason: string) => void }): DrawerApi {
        return createDrawer(options, this);
    }

    /* ── Context menu (src/context-menu.js) ───────────────────── */

    public showContextMenu(opts: ContextMenuOptions): void {
        this.hideContextMenu();
        const items = opts.items;
        if (!items) return;
        const options: ContextMenuOptions = Object.assign({ x: 0, y: 0 }, opts);
        const menu = $tag('div', { class: 'ctx-menu', role: 'menu' });
        menu.style.left = `${options.x}px`;
        menu.style.top = `${options.y}px`;

        items.forEach((item) => {
            if (item.sep) {
                menu.appendChild($tag('div', { class: 'ctx-sep', role: 'separator' }));
                return;
            }
            const el = $tag('div', { class: 'ctx-item', role: 'menuitem', tabindex: '-1' });
            if (item.checked !== undefined) {
                const check = $tag('span', { class: 'ctx-check' });
                check.textContent = item.checked ? '✓' : '';
                el.appendChild(check);
                el.setAttribute('aria-checked', item.checked ? 'true' : 'false');
            }
            el.appendChild($tag('span', {}, [$text(item.label ?? '')]));
            if (item.kbd) el.appendChild($tag('span', { class: 'ctx-kbd' }, [$text(item.kbd)]));
            if (item.disabled) {
                el.classList.add('disabled');
                el.setAttribute('aria-disabled', 'true');
            }
            const onClick = item.onclick;
            if (onClick) {
                el.addEventListener('click', ((e: MouseEvent) => {
                    e.stopPropagation();
                    if (!item.disabled) {
                        onClick();
                        this.hideContextMenu();
                    }
                }) as EventListener);
            }
            menu.appendChild(el);
        });

        this._mountNode(menu);

        const mr = menu.getBoundingClientRect();
        if (mr.right > window.innerWidth) menu.style.left = `${(options.x ?? 0) - mr.width}px`;
        if (mr.bottom > window.innerHeight) menu.style.top = `${(options.y ?? 0) - mr.height}px`;

        this._ctxMenuEl = menu;
        this._ctxMenuPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        // Keyboard navigation: ArrowUp/Down + Home/End move focus, Enter/Space
        // activates, Escape closes — focus returns to the previously focused
        // element (or the element that opened the menu).
        this._ctxMenuKeyHandler = ((event: KeyboardEvent) => {
            const enabled = Array.from(menu.querySelectorAll<HTMLElement>('.ctx-item')).filter((it) => !it.classList.contains('disabled'));
            if (enabled.length === 0) return;
            const idx = enabled.indexOf(document.activeElement as HTMLElement);
            const move = (next: number): void => {
                event.preventDefault();
                enabled[next]?.focus();
            };
            switch (event.key) {
                case 'ArrowDown': move(idx < 0 || idx === enabled.length - 1 ? 0 : idx + 1); break;
                case 'ArrowUp': move(idx <= 0 ? enabled.length - 1 : idx - 1); break;
                case 'Home': move(0); break;
                case 'End': move(enabled.length - 1); break;
                case 'Escape':
                    event.preventDefault();
                    this.hideContextMenu();
                    break;
                case 'Enter':
                case ' ':
                    if (idx >= 0) { event.preventDefault(); enabled[idx].click(); }
                    break;
                default: break;
            }
        }) as (event: KeyboardEvent) => void;
        document.addEventListener('keydown', this._ctxMenuKeyHandler);

        window.setTimeout(() => {
            this._ctxMenuHandler = (() => this.hideContextMenu()) as EventListener;
            this._listen(document, 'click', this._ctxMenuHandler, { once: true });
        }, 0);
    }

    public hideContextMenu(): void {
        if (this._ctxMenuEl) {
            this._unmountNode(this._ctxMenuEl);
            this._ctxMenuEl = null;
        }
        if (this._ctxMenuKeyHandler) {
            document.removeEventListener('keydown', this._ctxMenuKeyHandler);
            this._ctxMenuKeyHandler = null;
        }
        if (this._ctxMenuHandler) {
            document.removeEventListener('click', this._ctxMenuHandler);
            this._ctxMenuHandler = null;
        }
        if (this._ctxMenuPreviousFocus) {
            this._ctxMenuPreviousFocus.focus();
            this._ctxMenuPreviousFocus = null;
        }
    }

    /* ── Cleanup ──────────────────────────────────────────────── */

    public destroy(): void {
        if (this._destroyed) return;
        this._destroyed = true;
        this._listenerController?.abort();
        if (this._clockInterval !== null) { window.clearInterval(this._clockInterval); this._clockInterval = null; }
        if (this._lockInterval !== null) { window.clearInterval(this._lockInterval); this._lockInterval = null; }
        this._animationsEnabled = false;
        this.closeAllWindows();
        this._wm.disposeSnapPreview();
        this._unmountNode(this._searchEl);
        this._searchEl = null;
        this._unmountNode(this._switcherEl);
        this._switcherEl = null;
        this._ownedNodes.forEach((node) => { if (node.parentNode) node.parentNode.removeChild(node); });
        this._ownedNodes.clear();
        this._tileSaved = [];
        this._tileActive = false;
        this._toasts = null;
        this.clearContentCache();
        this.hideContextMenu();
        this._queryAll('.desktop-grid, #expose-backdrop, #explosion-canvas, #lock-screen, #toast-center').forEach((el) => this._unmountNode(el));
        this._listeners = Object.create(null);
    }

    /* ── Static factory ───────────────────────────────────────── */

    public static create(config?: PrestigeConfig): Prestige {
        const instance = new Prestige(config);
        instance.init();
        return instance;
    }

    public static mixin(descriptor: Record<string, unknown>): void {
        Object.assign(Prestige.prototype, descriptor);
    }

    /* ── Component registry (parity with vanilla Prestige.components) ── */

    /** Shared component registry (drop-in for the vanilla `Prestige.components`). */
    public static components = defaultRegistry;

    /** Register a component factory. */
    public static registerComponent(name: string, factory: ComponentFactory, options?: { replace?: boolean }): typeof Prestige {
        defaultRegistry.register(name, factory, options);
        return Prestige;
    }

    /** Unregister a component factory. */
    public static unregisterComponent(name: string): typeof Prestige {
        defaultRegistry.unregister(name);
        return Prestige;
    }

    /** Check whether a component is registered. */
    public static hasComponent(name: string): boolean {
        return defaultRegistry.has(name);
    }

    /** Retrieve a registered component factory. */
    public static getComponent(name: string): ComponentFactory | null {
        return defaultRegistry.get(name);
    }

    /** List all registered component names. */
    public static listComponents(): string[] {
        return defaultRegistry.list();
    }

    /** Instantiate a registered component via the shared registry. */
    public createComponent(name: string, options: ComponentOptions = {}): HTMLElement {
        return defaultRegistry.create(name, options, this);
    }

    /* ── Internal helpers ─────────────────────────────────────── */

    private _getFocusedWindow(): WindowElement | null {
        const el = this._query('.window.is-focused');
        return el instanceof HTMLElement ? (el as WindowElement) : null;
    }
}

// Re-export the window element / record types for consumers.
export type { WindowElement, WindowRecord, SnapZone } from './WindowManager.js';
