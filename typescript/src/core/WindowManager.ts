/* ═══════════════════════════════════════════════════════════════════════════
   Prestige UI — Window Manager
   TypeScript port of src/window.js. Window lifecycle, FLIP animations, magnet
   snap, 8-direction resize, drag gestures (shake / flick), and App Isolation
   Tiers. Every window carries a `DisposalStack` bound to `closeWindow()`.
   ═══════════════════════════════════════════════════════════════════════════ */
import { DisposalStack, Owned } from './Memory.js';
import { $tag, $text, replaceContent, isolatedPostTargetOrigin } from '../utils/dom.js';
import { assertSafeAppId, isSafeIframeSrc, sanitizeTitlebarHtml, sanitizeWith } from '../utils/sanitize.js';
import { renderIcons } from '../ui/LucideIcons.js';
import type { AppContent, AppManifest, SecurityOptions } from '../types/desktop.js';

/** Pointer-like coordinates shared by mouse and touch gestures. */
type GesturePoint = { clientX: number; clientY: number };

/** True when the device reports any touch capability. */
const hasTouch = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);

/** Extract the active pointer position from a mouse or touch event. */
function eventPoint(e: MouseEvent | TouchEvent): GesturePoint | null {
    if ('touches' in e) {
        const touch = e.touches[0];
        return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
    }
    return { clientX: e.clientX, clientY: e.clientY };
}

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

interface DockTransform {
    dx: number;
    dy: number;
    sx: number;
    sy: number;
}

interface ShakeData {
    positions: Array<{ x: number; y: number; time: number }>;
    crossCount: number;
    prevVelX: number;
    prevVelY: number;
    lastCrossTime: number;
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

const DEFAULT_WINDOW_SIZES: Record<string, [number, number]> = {
    overview: [780, 540], wizard: [780, 580], analytics: [900, 620],
    infra: [760, 540], keys: [720, 520], models: [740, 540],
    widget: [720, 540], prompts: [760, 560], routing: [740, 540],
    guard: [720, 560], memory: [760, 540], breakers: [720, 500],
    vector: [740, 540], rag: [800, 580], upload: [740, 520],
    gdpr: [740, 540], observe: [760, 540], groups: [720, 540],
    users: [740, 560], register: [680, 500], logs: [760, 540],
    audit: [740, 520], feedback: [760, 540], limits: [700, 500],
    config: [800, 560], about: [640, 480], calendar: [760, 560],
    notes: [720, 540], system: [820, 600],
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Owns window state (open windows, z-order, cascade, snap preview) and all
 * window lifecycle / geometry / gesture logic. Hosted by the Prestige engine.
 */
export class WindowManager {
    private readonly _openWindows: Record<string, WindowRecord> = Object.create(null);
    private _zCounter = 100;
    private _cascadeIndex = 0;
    private _snapPreviewEl: HTMLElement | null = null;

    constructor(private readonly _host: WindowManagerHost) {}

    /* ── Geometry ─────────────────────────────────────────────── */

    public getSafeBounds(): SafeBounds {
        const canvasEl = this._host._query('#desktop-canvas');
        const dockEl = this._host._query('.dock-wrap');
        const canvasTop = canvasEl ? Math.round(canvasEl.getBoundingClientRect().top) : 30;
        let dockTop = dockEl ? Math.round(dockEl.getBoundingClientRect().top) : (window.innerHeight - 100);
        const maxSafeDockTop = window.innerHeight - 102;
        if (dockTop > maxSafeDockTop) dockTop = maxSafeDockTop;
        return { top: 2, bottom: dockTop - canvasTop - 2, left: 0, right: window.innerWidth };
    }

    public _getMaximizeTarget(): MaximizeTarget {
        const dockEl = this._host._query('.dock-wrap');
        let dockTop = dockEl ? Math.round(dockEl.getBoundingClientRect().top) : (window.innerHeight - 100);
        const maxSafeDockTop = window.innerHeight - 102;
        if (dockTop > maxSafeDockTop) dockTop = maxSafeDockTop;
        const canvasEl = this._host._query('#desktop-canvas');
        const canvasTop = canvasEl ? Math.round(canvasEl.getBoundingClientRect().top) : 30;
        const margin = 8;
        return {
            top: 0,
            left: margin,
            width: window.innerWidth - margin * 2,
            height: dockTop - canvasTop,
            halfWidth: (window.innerWidth - margin * 2) / 2,
        };
    }

    private _calculateDockTransform(win: WindowElement): DockTransform {
        const section = win.getAttribute('data-section') ?? '';
        const rec = this._openWindows[section];
        const dockBtn = rec && rec.btn ? rec.btn : this._host._query(`.dock-item[data-section="${section}"]`);
        const winRect = win.getBoundingClientRect();
        let targetRect: { left: number; top: number; width: number; height: number };
        if (dockBtn instanceof HTMLElement && dockBtn.isConnected) {
            targetRect = dockBtn.getBoundingClientRect();
        } else {
            targetRect = { left: window.innerWidth / 2 - 26, top: window.innerHeight - 60, width: 52, height: 52 };
        }
        return {
            dx: targetRect.left + targetRect.width / 2 - (winRect.left + winRect.width / 2),
            dy: targetRect.top + targetRect.height / 2 - (winRect.top + winRect.height / 2),
            sx: targetRect.width / winRect.width,
            sy: targetRect.height / winRect.height,
        };
    }

    public toggleBounce(section: string): void {
        const rec = this._openWindows[section];
        if (rec && rec.btn) {
            rec.btn.classList.remove('is-bouncing');
            void rec.btn.offsetWidth;
            rec.btn.classList.add('is-bouncing');
            window.setTimeout(() => rec.btn?.classList.remove('is-bouncing'), 700);
        }
    }

    /* ── Titlebar / content builders (structural DOM only) ────── */

    private _defaultControls(): HTMLElement {
        return $tag('div', { class: 'window-controls' }, [
            $tag('button', { class: 'window-btn window-btn-minimize', 'data-act': 'minimize', title: 'Minimize' }),
            $tag('button', { class: 'window-btn window-btn-maximize', 'data-act': 'maximize', title: 'Maximize' }),
            $tag('button', { class: 'window-btn window-btn-close', 'data-act': 'close', title: 'Close' }),
        ]);
    }

    private _defaultTitlebar(label: string, icon?: string): HTMLElement {
        const titlebar = $tag('div', { class: 'window-titlebar' });
        const title = $tag('div', { class: 'window-title' });
        if (icon) {
            const iconSpan = $tag('span', { class: 'window-title-icon' });
            iconSpan.appendChild($tag('i', { 'data-prestige-icon': icon }));
            title.appendChild(iconSpan);
        }
        title.appendChild($text(label));
        titlebar.append(title, this._defaultControls());
        return titlebar;
    }

    private _buildTitlebar(label: string, icon?: string): Node {
        if (this._host.config.renderTitlebar) {
            const rendered = this._host.config.renderTitlebar(label, icon);
            if (rendered instanceof Node) return rendered;
            const sanitizer = this._host.config.security?.sanitizer;
            if (sanitizer) return sanitizeWith(rendered, sanitizer);
            return sanitizeTitlebarHtml(rendered);
        }
        return this._defaultTitlebar(label, icon);
    }

    private _statCard(value: string, label: string): HTMLElement {
        return $tag('div', { class: 'stat-card' }, [
            $tag('div', { class: 'stat-value' }, [$text(value)]),
            $tag('div', { class: 'stat-label' }, [$text(label)]),
        ]);
    }

    /** Create the built-in window content (structural). */
    public createContent(section: string, label?: string, icon?: string): AppContent {
        const appContent = this._appConfig(section);
        if (appContent && appContent.content) {
            return typeof appContent.content === 'function' ? appContent.content(section, label ?? section, icon ?? '') : appContent.content;
        }
        const main = $tag('div', { class: 'window-content-main' });
        const card = $tag('div', { class: 'card' });
        const header = $tag('div', { class: 'card-header' }, [$tag('h3', {}, [$text(section === 'overview' ? 'System Overview' : label ?? section)])]);
        const body = $tag('div', { class: 'card-body' });
        const stats = $tag('div', { class: 'stats-row' });

        if (section === 'overview') {
            stats.append(
                this._statCard('98%', 'Uptime'),
                this._statCard('2.4s', 'Avg Latency'),
                this._statCard('1.2K', 'Req/s'),
            );
            body.append(stats, $tag('p', { style: { color: 'var(--text-secondary)', lineHeight: '1.7' } }, [$text('System is healthy. All services operational.')]));
        } else {
            stats.append(
                this._statCard(section.charAt(0).toUpperCase(), 'Section'),
                this._statCard('✓', 'Status'),
                this._statCard('42', 'Items'),
            );
            const welcome = $tag('p', { style: { color: 'var(--text-secondary)', lineHeight: '1.7' } }, [
                $text('Welcome to the '),
                $tag('strong', {}, [$text(label ?? section)]),
                $text(' section.'),
            ]);
            const actions = $tag('div', { style: { display: 'flex', gap: '12px', marginTop: '16px' } }, [
                $tag('button', { class: 'btn btn-primary', type: 'button', 'data-prestige-action': 'info' }, [$text('Action')]),
                $tag('button', { class: 'btn btn-ghost', type: 'button', 'data-prestige-action': 'minimize' }, [$text('Minimize')]),
            ]);
            body.append(stats, welcome, actions);
        }
        card.append(header, body);
        main.appendChild(card);
        return main;
    }

    /* ── Window creation ──────────────────────────────────────── */

    public nextCascadePos(): { x: number; y: number } {
        const canvas = this._host._query('#desktop-canvas');
        const cw = canvas ? canvas.clientWidth : window.innerWidth;
        const ch = canvas ? canvas.clientHeight : window.innerHeight;
        const baseX = Math.max(40, Math.floor((cw - 800) / 2));
        const baseY = Math.max(20, Math.floor((ch - 600) / 3));
        const i = this._cascadeIndex % 8;
        return { x: baseX + i * 30, y: baseY + i * 30 };
    }

    public createWindow(section: string, icon?: string, label?: string): WindowElement {
        if (typeof section !== 'string') throw new Error('Prestige app IDs must be strings.');
        assertSafeAppId(section);
        const appConfig = this._appConfig(section);
        const win = $tag('div', { class: 'window', 'data-section': section }) as WindowElement;
        win._disposal = new DisposalStack(section);
        const disposal = win._disposal;

        const off = this.nextCascadePos();
        win.style.left = `${off.x}px`;
        win.style.top = `${off.y}px`;
        const defaults = DEFAULT_WINDOW_SIZES[section] ?? [760, 540];
        const size: [number, number] = [appConfig?.w ?? defaults[0], appConfig?.h ?? defaults[1]];
        win.style.width = `${size[0]}px`;
        win.style.height = `${size[1]}px`;

        const safeLabel = label ?? section;
        win.append(this._buildTitlebar(safeLabel, icon), $tag('div', { class: 'window-body' }), $tag('div', { class: 'window-resize', 'data-act': 'resize' }));

        const closeBtn = win.querySelector('[data-act="close"]');
        if (closeBtn) disposal.listen(closeBtn, 'click', ((e: Event) => { e.stopPropagation(); this.closeWindow(win); }) as EventListener);
        const minimizeBtn = win.querySelector('[data-act="minimize"]');
        if (minimizeBtn) disposal.listen(minimizeBtn, 'click', ((e: Event) => { e.stopPropagation(); this.minimizeWindow(win); }) as EventListener);
        const maximizeBtn = win.querySelector('[data-act="maximize"]');
        if (maximizeBtn) disposal.listen(maximizeBtn, 'click', ((e: Event) => { e.stopPropagation(); this.toggleMaximize(win); }) as EventListener);

        const dirs: ResizeDirection[] = ['nw', 'n', 'ne', 'e', 's', 'sw', 'w'];
        const seHandle = win.querySelector('.window-resize');
        if (seHandle) {
            seHandle.classList.add('window-resize-handle', 'window-resize-se');
            disposal.listen(seHandle, 'mousedown', ((e: MouseEvent) => { e.stopPropagation(); this.startResize(win, e, 'se'); }) as EventListener);
            if (hasTouch) disposal.listen(seHandle, 'touchstart', ((e: TouchEvent) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); this.startResize(win, e, 'se'); }) as EventListener, { passive: false });
        }
        dirs.forEach((dir) => {
            const handle = $tag('div', { class: `window-resize-handle window-resize-${dir}` });
            win.appendChild(handle);
            disposal.listen(handle, 'mousedown', ((e: MouseEvent) => { e.stopPropagation(); this.startResize(win, e, dir); }) as EventListener);
            if (hasTouch) disposal.listen(handle, 'touchstart', ((e: TouchEvent) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); this.startResize(win, e, dir); }) as EventListener, { passive: false });
        });

        const titlebarEl = win.querySelector('.window-titlebar');
        if (titlebarEl) {
            disposal.listen(titlebarEl, 'mousedown', ((e: MouseEvent) => {
                const target = e.target as Element | null;
                if (target && (target.closest('.window-controls') || target.closest('.window-btn'))) return;
                if (e.detail === 2) { this.toggleMaximize(win); return; }
                this.startDrag(win, e);
            }) as EventListener);
            if (hasTouch) disposal.listen(titlebarEl, 'touchstart', ((e: TouchEvent) => {
                const target = e.target as Element | null;
                if (target && (target.closest('.window-controls') || target.closest('.window-btn'))) return;
                if (e.touches.length !== 1) return;
                if (e.cancelable) e.preventDefault();
                this.startDrag(win, e);
            }) as EventListener, { passive: false });
        }
        disposal.listen(win, 'mousedown', (() => { this.focusWindow(win); }) as EventListener);

        const body = win.querySelector<HTMLElement>('.window-body');
        if (body) {
            if (appConfig && appConfig.tier === 'isolated') {
                // Scheme-validate the manifest src: untrusted manifests must
                // never control active frame content (no data:/blob:/
                // javascript: frames). Invalid sources fall back to about:blank.
                const frameSrc = appConfig.src && isSafeIframeSrc(appConfig.src) ? appConfig.src : 'about:blank';
                const iframe = $tag('iframe', { class: 'prestige-app-sandbox', sandbox: 'allow-scripts allow-forms', src: frameSrc });
                if (typeof MessageChannel !== 'undefined') {
                    let channel: MessageChannel | null = null;
                    const closeChannel = (): void => {
                        if (!channel) return;
                        try { channel.port1.close(); } catch (_e) { /* already closed */ }
                        try { channel.port2.close(); } catch (_e) { /* already closed */ }
                        channel = null;
                    };
                    disposal.defer(closeChannel);
                    disposal.listen(iframe, 'load', (() => {
                        closeChannel();
                        channel = new MessageChannel();
                        try {
                            const resolver = this._host.config.security?.postTargetOrigin ?? isolatedPostTargetOrigin;
                            const targetOrigin = resolver(iframe.sandbox.value, frameSrc, window.location.href);
                            iframe.contentWindow?.postMessage({ type: 'PRESTIGE_INIT', section }, targetOrigin, [channel.port2]);
                        } catch (_e) {
                            closeChannel();
                        }
                    }) as EventListener);
                }
                body.appendChild(iframe);
            } else {
                const content = this.createContent(section, safeLabel, icon);
                if (content instanceof HTMLElement && content.classList.contains('window-content-main')) {
                    body.appendChild(content);
                } else {
                    const main = $tag('div', { class: 'window-content-main' });
                    if (content instanceof Node) main.appendChild(content);
                    else replaceContent(main, content, !appConfig || appConfig.trustedHtml === true, this._host.config.security?.sanitizer);
                    body.appendChild(main);
                }
            }

            body.querySelectorAll<HTMLElement>('[data-prestige-action]').forEach((button) => {
                const action = button.getAttribute('data-prestige-action');
                if (action === 'info') {
                    disposal.listen(button, 'click', (() => { void this._host.dialogInfo(`${safeLabel} action executed.`); }) as EventListener);
                }
                if (action === 'minimize') {
                    disposal.listen(button, 'click', (() => { this.minimizeWindow(win); }) as EventListener);
                }
            });
        }

        disposal.setTimeout(() => renderIcons(this._host.config.container ?? document), 10);
        return win;
    }

    /* ── Open / close ─────────────────────────────────────────── */

    public openWindow(
        section: string,
        icon?: string,
        label?: string,
        dockBtn?: HTMLElement | null,
        options: OpenWindowOptions = {},
    ): WindowElement | undefined {
        if (typeof section !== 'string') throw new Error('Prestige app IDs must be strings.');
        assertSafeAppId(section);
        const existing = this._openWindows[section];
        if (existing && existing.el && existing.el.isConnected) {
            if (existing.el.classList.contains('is-closing')) {
                this.removeWindowRecord(existing, true);
            } else if (existing.minimized) {
                this.restoreWindow(existing.el);
                this.focusWindow(existing.el);
                return existing.el;
            } else if (existing.el.classList.contains('is-focused')) {
                this.minimizeWindow(existing.el);
                return existing.el;
            } else {
                this.focusWindow(existing.el);
                return existing.el;
            }
        }

        const win = this.createWindow(section, icon, label);
        const canvas = this._host._query('#desktop-canvas');
        if (canvas) canvas.appendChild(win);
        const record: WindowRecord = { el: win, minimized: false, zoomed: false, transitionVersion: 0 };
        if (icon !== undefined) record.icon = icon;
        if (label !== undefined) record.label = label;
        if (dockBtn !== undefined) record.btn = dockBtn;
        this._openWindows[section] = record;
        if (dockBtn) dockBtn.classList.add('is-open');

        const appConfig = this._appConfig(section);
        const shouldAnimate = options.animate ?? this._host.animationsEnabled;
        const shouldFocus = options.focus ?? true;
        const applyManifestMaximized = options.applyManifestMaximized ?? true;
        if (shouldAnimate) {
            const version = ++record.transitionVersion;
            win.style.animation = 'none';
            const tf = this._calculateDockTransform(win);
            win.style.setProperty('--tx', `${tf.dx}px`);
            win.style.setProperty('--ty', `${tf.dy}px`);
            win.style.setProperty('--sx', String(tf.sx));
            win.style.setProperty('--sy', String(tf.sy));
            win.classList.add('is-minimized');
            requestAnimationFrame(() => {
                if (!this._isCurrent(section, record) || record.transitionVersion !== version) return;
                win.classList.add('is-animating-restore');
                requestAnimationFrame(() => {
                    if (!this._isCurrent(section, record) || record.transitionVersion !== version) return;
                    win.classList.remove('is-minimized');
                    if (shouldFocus) this.focusWindow(win);
                    if (applyManifestMaximized && appConfig?.maximized) this.toggleMaximize(win);
                });
            });
            win._disposal?.setTimeout(() => {
                if (this._isCurrent(section, record) && !record.minimized) win.classList.remove('is-animating-restore');
            }, 400);
        } else {
            if (shouldFocus) this.focusWindow(win);
            if (applyManifestMaximized && appConfig?.maximized) this.toggleMaximize(win, options.save ?? true);
        }

        this._host._emit('window:open', { section, win, icon, label });
        this._cascadeIndex += 1;
        if (options.save ?? true) this._host._saveSession();
        return win;
    }

    public closeWindow(win: WindowElement): void {
        const section = win.getAttribute('data-section') ?? '';
        const rec = this._openWindows[section];
        if (!rec || rec.el !== win) {
            this._disposeWindow(win);
            win.remove();
            return;
        }
        this._disposeWindow(win);
        rec.transitionVersion += 1;
        win.classList.remove('is-snapped');
        if (this._host.animationsEnabled) {
            win.classList.add('is-closing');
            window.setTimeout(() => {
                this.removeWindowRecord(rec);
            }, 180);
        } else {
            this.removeWindowRecord(rec);
        }
    }

    public ownResource<T>(win: WindowElement, resource: T, disposer: (value: T) => void): Owned<T> {
        const owned = new Owned(resource, disposer);
        if (win && win._disposal && !win._disposal.isDisposed) win._disposal.own(owned);
        else owned.dispose();
        return owned;
    }

    public ownSocket(win: WindowElement, url: string, protocols?: string | string[]): Owned<WebSocket> {
        const ws = new WebSocket(url, protocols);
        return this.ownResource(win, ws, (socket) => {
            if (socket.readyState < WebSocket.CLOSING) { try { socket.close(); } catch (_e) { /* already closed */ } }
        });
    }

    /* ── Minimize / restore / maximize / focus ────────────────── */

    public minimizeWindow(win: WindowElement): void {
        if (!win) return;
        const section = win.getAttribute('data-section') ?? '';
        const rec = this._openWindows[section];
        if (!rec || rec.el !== win || rec.minimized) return;
        rec.minimized = true;
        const version = ++rec.transitionVersion;
        win.classList.remove('is-snapped', 'is-animating-restore');
        if (this._host.animationsEnabled) {
            const tf = this._calculateDockTransform(win);
            win.style.setProperty('--tx', `${tf.dx}px`);
            win.style.setProperty('--ty', `${tf.dy}px`);
            win.style.setProperty('--sx', String(tf.sx));
            win.style.setProperty('--sy', String(tf.sy));
            win.classList.add('is-animating-minimize');
            requestAnimationFrame(() => {
                if (this._isCurrent(section, rec) && rec.transitionVersion === version && rec.minimized) win.classList.add('is-minimized');
            });
            win._disposal?.setTimeout(() => {
                if (!this._isCurrent(section, rec) || rec.transitionVersion !== version || !rec.minimized) return;
                win.classList.add('is-gone');
                win.classList.remove('is-animating-minimize');
                if (rec.btn) { rec.btn.classList.add('has-minimized'); this.toggleBounce(section); }
            }, 400);
        } else {
            win.classList.add('is-minimized', 'is-gone');
            if (rec && rec.btn) rec.btn.classList.add('has-minimized');
        }
        this._host._emit('window:minimize', { win });
        this._host._saveSession();
        const visible = this._getSwitcherWindows().filter((w) => w !== win);
        if (visible.length > 0) this.focusWindow(visible[visible.length - 1]);
    }

    public restoreWindow(win: WindowElement): void {
        if (!win) return;
        const section = win.getAttribute('data-section') ?? '';
        const rec = this._openWindows[section];
        if (!rec || rec.el !== win) return;
        rec.minimized = false;
        const version = ++rec.transitionVersion;
        win.classList.remove('is-animating-minimize');
        if (this._host.animationsEnabled) {
            const firstRect = win.getBoundingClientRect();
            win.classList.remove('is-minimized', 'is-gone');
            const lastRect = win.getBoundingClientRect();
            const dx = firstRect.left - lastRect.left;
            const dy = firstRect.top - lastRect.top;
            const sx = firstRect.width / lastRect.width;
            const sy = firstRect.height / lastRect.height;
            win.classList.add('is-animating-restore');
            win.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
            win.style.opacity = '0';
            win.style.borderRadius = '40px';
            win.style.filter = 'brightness(1.25) blur(1px)';
            void win.offsetWidth;
            win.style.transform = '';
            win.style.opacity = '';
            win.style.borderRadius = '';
            win.style.filter = '';
            win._disposal?.setTimeout(() => {
                if (!this._isCurrent(section, rec) || rec.transitionVersion !== version || rec.minimized) return;
                win.classList.remove('is-animating-restore');
                if (rec.btn) rec.btn.classList.remove('has-minimized');
            }, 400);
        } else {
            win.classList.remove('is-minimized', 'is-gone');
            rec.btn?.classList.remove('has-minimized');
        }
        this.focusWindow(win);
        this._host._emit('window:restore', { win });
        this._host._saveSession();
    }

    public toggleMaximize(win: WindowElement, save = true): void {
        const section = win.getAttribute('data-section') ?? '';
        const rec = this._openWindows[section];
        if (!rec || rec.el !== win) return;
        const version = ++rec.transitionVersion;
        if (rec.zoomed) {
            rec.zoomed = false;
            this._host._emit('window:restore-maximize', { win });
            const firstRect = win.getBoundingClientRect();
            win.classList.remove('is-snapped');
            win.style.left = win.dataset.rL ?? '';
            win.style.top = win.dataset.rT ?? '';
            win.style.width = win.dataset.rW ?? '';
            win.style.height = win.dataset.rH ?? '';
            const lastRect = win.getBoundingClientRect();
            const dx = firstRect.left - lastRect.left;
            const dy = firstRect.top - lastRect.top;
            const sx = firstRect.width / lastRect.width;
            const sy = firstRect.height / lastRect.height;
            win.classList.add('is-animating-maximize');
            win.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
            requestAnimationFrame(() => {
                if (!this._isCurrent(section, rec) || rec.transitionVersion !== version || rec.zoomed) return;
                win.classList.remove('is-zoomed');
                win.style.transform = '';
                win.classList.remove('is-animating-maximize');
            });
            if (save) this._host._saveSession();
        } else {
            rec.zoomed = true;
            win.classList.remove('is-snapped');
            win.dataset.rL = win.style.left;
            win.dataset.rT = win.style.top;
            win.dataset.rW = win.style.width;
            win.dataset.rH = win.style.height;
            const firstRect = win.getBoundingClientRect();
            const t = this._getMaximizeTarget();
            win.style.left = `${t.left}px`;
            win.style.top = `${t.top}px`;
            win.style.width = `${t.width}px`;
            win.style.height = `${t.height}px`;
            const lastRect = win.getBoundingClientRect();
            const dx = firstRect.left - lastRect.left;
            const dy = firstRect.top - lastRect.top;
            const sx = firstRect.width / lastRect.width;
            const sy = firstRect.height / lastRect.height;
            win.classList.add('is-animating-maximize', 'is-zoomed');
            win.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
            this._host._emit('window:maximize', { win });
            requestAnimationFrame(() => {
                if (!this._isCurrent(section, rec) || rec.transitionVersion !== version || !rec.zoomed) return;
                win.style.transform = '';
                win.classList.remove('is-animating-maximize');
            });
            if (save) this._host._saveSession();
        }
    }

    public focusWindow(win: WindowElement): void {
        if (!win) return;
        const section = win.getAttribute('data-section') ?? '';
        const rec = this._openWindows[section];
        if (!rec || rec.el !== win || rec.minimized) return;
        this._host._queryAll('.window.is-focused').forEach((w) => w.classList.remove('is-focused'));
        win.classList.add('is-focused');
        this._zCounter += 1;
        win.style.zIndex = String(this._zCounter);
        const titleEl = this._host._query('#active-window-title');
        if (titleEl) {
            titleEl.textContent = rec.label ?? section;
        }
        this._host._emit('window:focus', { win, section });
    }

    /* ── Drag & gestures ──────────────────────────────────────── */

    public startDrag(win: WindowElement, e: MouseEvent | TouchEvent): void {
        const record = this._recordFor(win);
        if (record?.zoomed) return;
        if (e.cancelable) e.preventDefault();
        const start = eventPoint(e);
        if (!start) return;
        win.classList.remove('is-snapped');
        const startX = start.clientX;
        const startY = start.clientY;
        const startL = parseInt(win.style.left, 10) || 0;
        const startT = parseInt(win.style.top, 10) || 0;
        win.classList.add('is-dragging');
        this._host._emit('window:dragstart', { win });

        const enableShake = this._host.config.shakeToMinimize ?? true;
        const enableFlick = this._host.config.flickToMinimize ?? true;
        const enableSnap = this._host.config.snap ?? true;
        let shakeData: ShakeData | null = enableShake ? { positions: [], crossCount: 0, prevVelX: 0, prevVelY: 0, lastCrossTime: 0 } : null;
        let activeSnapZone: SnapZone | null = null;
        let lastY = start.clientY;
        let lastTime = performance.now();
        let velocityY = 0;

        const onMove = (ev: MouseEvent | TouchEvent): void => {
            const point = eventPoint(ev);
            if (!point) return;
            if (ev.cancelable) ev.preventDefault();
            const now = performance.now();
            const dt = now - lastTime;
            if (dt > 0 && enableFlick) { velocityY = (point.clientY - lastY) / dt; lastY = point.clientY; lastTime = now; }
            const dx = point.clientX - startX;
            const dy = point.clientY - startY;
            const bounds = this.getSafeBounds();
            const w = win.offsetWidth;
            const h = win.offsetHeight;
            const nx = clamp(startL + dx, bounds.left - w + 80, bounds.right - 80);
            const ny = clamp(startT + dy, bounds.top, bounds.bottom - h);
            win.style.left = `${nx}px`;
            win.style.top = `${ny}px`;

            if (enableShake && shakeData) {
                shakeData.positions.push({ x: point.clientX, y: point.clientY, time: now });
                if (shakeData.positions.length > 20) shakeData.positions.shift();
                if (shakeData.positions.length >= 4) {
                    const a = shakeData.positions[shakeData.positions.length - 4];
                    const b = shakeData.positions[shakeData.positions.length - 1];
                    const velX = b.x - a.x;
                    const velY = b.y - a.y;
                    let crossed = false;
                    if (Math.abs(velX) > 8 && shakeData.prevVelX !== 0 && velX !== 0) {
                        if ((shakeData.prevVelX > 0 && velX < 0) || (shakeData.prevVelX < 0 && velX > 0)) crossed = true;
                    }
                    if (Math.abs(velY) > 8 && shakeData.prevVelY !== 0 && velY !== 0) {
                        if ((shakeData.prevVelY > 0 && velY < 0) || (shakeData.prevVelY < 0 && velY > 0)) crossed = true;
                    }
                    if (crossed) {
                        shakeData.crossCount += 1;
                        if (shakeData.crossCount >= 3 && now - shakeData.lastCrossTime < 600) {
                            this._minimizeOtherWindows(win);
                            shakeData.crossCount = 0;
                        }
                        shakeData.lastCrossTime = now;
                    }
                    shakeData.prevVelX = velX;
                    shakeData.prevVelY = velY;
                }
            }
            if (enableSnap) activeSnapZone = this._snapCheck(win);
        };

        const onUp = (): void => {
            win.classList.remove('is-dragging');
            document.removeEventListener('mousemove', onMove as EventListener);
            document.removeEventListener('mouseup', onUp as EventListener);
            document.removeEventListener('touchmove', onMove as EventListener);
            document.removeEventListener('touchend', onUp as EventListener);
            shakeData = null;
            if (enableFlick && velocityY > 1.1 && !record?.zoomed) {
                this.minimizeWindow(win);
                if (enableSnap) this._snapClear();
                activeSnapZone = null;
                return;
            }
            if (enableSnap && activeSnapZone) { this._applySnapOnRelease(win, activeSnapZone); activeSnapZone = null; }
            if (enableSnap) this._snapClear();
            this._host._emit('window:dragend', { win });
            this._host._saveSession();
        };

        this._host._listen(document, 'mousemove', onMove as EventListener);
        this._host._listen(document, 'mouseup', onUp as EventListener);
        if (hasTouch || 'touches' in e) {
            this._host._listen(document, 'touchmove', onMove as EventListener, { passive: false });
            this._host._listen(document, 'touchend', onUp as EventListener);
        }
    }

    public startResize(win: WindowElement, e: MouseEvent | TouchEvent, dir: ResizeDirection): void {
        if (this._recordFor(win)?.zoomed) return;
        if (e.cancelable) e.preventDefault();
        const start = eventPoint(e);
        if (!start) return;
        const startX = start.clientX;
        const startY = start.clientY;
        const startW = parseFloat(win.style.width) || win.offsetWidth;
        const startH = parseFloat(win.style.height) || win.offsetHeight;
        const startL = parseFloat(win.style.left) || 0;
        const startT = parseFloat(win.style.top) || 0;
        this._host._emit('window:resizestart', { win, dir });

        const onMove = (ev: MouseEvent | TouchEvent): void => {
            const point = eventPoint(ev);
            if (!point) return;
            if (ev.cancelable) ev.preventDefault();
            const dx = point.clientX - startX;
            const dy = point.clientY - startY;
            let w = startW;
            let h = startH;
            let x = startL;
            let y = startT;
            switch (dir) {
                case 'se': w = startW + dx; h = startH + dy; break;
                case 'e': w = startW + dx; break;
                case 's': h = startH + dy; break;
                case 'sw': w = startW - dx; h = startH + dy; x = startL + dx; break;
                case 'n': h = startH - dy; y = startT + dy; break;
                case 'ne': w = startW + dx; h = startH - dy; y = startT + dy; break;
                case 'nw': w = startW - dx; h = startH - dy; x = startL + dx; y = startT + dy; break;
                case 'w': w = startW - dx; x = startL + dx; break;
            }
            const bounds = this.getSafeBounds();
            w = Math.max(420, w);
            if (dir.includes('n')) {
                const anchorBottom = clamp(startT + startH, bounds.top, bounds.bottom);
                const feasibleMinH = Math.min(280, Math.max(0, anchorBottom - bounds.top));
                y = clamp(y, bounds.top, anchorBottom - feasibleMinH);
                h = anchorBottom - y;
            } else {
                const availableH = Math.max(0, bounds.bottom - y);
                const feasibleMinH = Math.min(280, availableH);
                h = clamp(h, feasibleMinH, availableH);
            }
            win.style.width = `${w}px`;
            win.style.height = `${h}px`;
            win.style.left = `${x}px`;
            win.style.top = `${y}px`;
        };

        const onUp = (): void => {
            document.removeEventListener('mousemove', onMove as EventListener);
            document.removeEventListener('mouseup', onUp as EventListener);
            document.removeEventListener('touchmove', onMove as EventListener);
            document.removeEventListener('touchend', onUp as EventListener);
            this._host._emit('window:resizeend', { win, dir });
            this._host._saveSession();
        };

        this._host._listen(document, 'mousemove', onMove as EventListener);
        this._host._listen(document, 'mouseup', onUp as EventListener);
        if (hasTouch || 'touches' in e) {
            this._host._listen(document, 'touchmove', onMove as EventListener, { passive: false });
            this._host._listen(document, 'touchend', onUp as EventListener);
        }
    }

    /* ── Snap ─────────────────────────────────────────────────── */

    public _snapCheck(win: WindowElement): SnapZone | null {
        const canvas = this._host._query('#desktop-canvas');
        if (!canvas) return null;
        const cvRect = canvas.getBoundingClientRect();
        const wr = win.getBoundingClientRect();
        const margin = 20;
        let zone: SnapZone | null = null;
        if (wr.top - cvRect.top <= margin) zone = 'top';
        else if (wr.left - cvRect.left <= margin) zone = 'left';
        else if (cvRect.width - (wr.right - cvRect.left) <= margin) zone = 'right';
        if (zone) this._showSnapPreview(zone);
        else this._snapClear();
        return zone;
    }

    private _getSnapPreview(): HTMLElement {
        if (!this._snapPreviewEl) {
            const el = document.createElement('div');
            el.className = 'snap-preview';
            el.style.opacity = '0';
            const canvas = this._host._query('#desktop-canvas');
            if (canvas) canvas.appendChild(el);
            this._snapPreviewEl = el;
        }
        return this._snapPreviewEl;
    }

    private _showSnapPreview(zone: SnapZone): void {
        const t = this._getMaximizeTarget();
        const el = this._getSnapPreview();
        let rect: { left: number; top: number; width: number; height: number };
        if (zone === 'left') rect = { left: t.left, top: t.top, width: t.halfWidth, height: t.height };
        else if (zone === 'right') rect = { left: t.left + t.halfWidth, top: t.top, width: t.halfWidth, height: t.height };
        else rect = { left: t.left, top: t.top, width: t.width, height: t.height };
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
        el.style.width = `${rect.width}px`;
        el.style.height = `${rect.height}px`;
        el.style.opacity = '1';
    }

    public _snapClear(): void {
        if (this._snapPreviewEl) this._snapPreviewEl.style.opacity = '0';
    }

    public _applySnapOnRelease(win: WindowElement, zone: SnapZone): void {
        const section = win.getAttribute('data-section') ?? '';
        const rec = this._openWindows[section];
        if (!rec || rec.el !== win) return;
        const version = ++rec.transitionVersion;
        this._host._emit('window:snap', { win, zone });
        const firstRect = win.getBoundingClientRect();
        if (!rec.zoomed) {
            win.dataset.rL = win.style.left;
            win.dataset.rT = win.style.top;
            win.dataset.rW = win.style.width;
            win.dataset.rH = win.style.height;
        }
        const t = this._getMaximizeTarget();
        let left: number;
        let width: number;
        if (zone === 'top') {
            rec.zoomed = true;
            win.classList.remove('is-snapped');
            left = t.left;
            width = t.width;
        } else if (zone === 'left') {
            rec.zoomed = false;
            win.classList.remove('is-zoomed');
            win.classList.add('is-snapped');
            left = t.left;
            width = t.halfWidth;
        } else {
            rec.zoomed = false;
            win.classList.remove('is-zoomed');
            win.classList.add('is-snapped');
            left = t.left + t.halfWidth;
            width = t.halfWidth;
        }
        win.style.left = `${left}px`;
        win.style.top = `${t.top}px`;
        win.style.width = `${width}px`;
        win.style.height = `${t.height}px`;
        const lastRect = win.getBoundingClientRect();
        const dx = firstRect.left - lastRect.left;
        const dy = firstRect.top - lastRect.top;
        const sx = firstRect.width / lastRect.width;
        const sy = firstRect.height / lastRect.height;
        win.classList.add('is-animating-maximize');
        if (zone === 'top') win.classList.add('is-zoomed');
        win.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
        requestAnimationFrame(() => {
            if (!this._isCurrent(section, rec) || rec.transitionVersion !== version) return;
            win.style.transform = '';
            win.classList.remove('is-animating-maximize');
        });
    }

    public _minimizeOtherWindows(win: WindowElement): void {
        for (const section of Object.keys(this._openWindows)) {
            const rec = this._openWindows[section];
            if (rec && rec.el && rec.el !== win && !rec.minimized) {
                this.minimizeWindow(rec.el);
            }
        }
    }

    /* ── Introspection ────────────────────────────────────────── */

    public _getSwitcherWindows(): WindowElement[] {
        const out: WindowElement[] = [];
        for (const section of Object.keys(this._openWindows)) {
            const rec = this._openWindows[section];
            if (rec && rec.el && rec.el.isConnected && !rec.minimized) out.push(rec.el);
        }
        return out;
    }

    public getOpenWindow(section: string): WindowRecord | undefined {
        return this._openWindows[section];
    }

    public getOpenWindowKeys(): string[] {
        return Object.keys(this._openWindows);
    }

    public getOpenWindowCount(): number {
        return Object.keys(this._openWindows).length;
    }

    /** Remove a specific record without allowing a stale callback to delete its replacement. */
    public removeWindowRecord(record: WindowRecord, suppressSessionSave = false): boolean {
        const win = record.el;
        const section = win.getAttribute('data-section') ?? '';
        this._disposeWindow(win);
        win.remove();
        if (!this._isCurrent(section, record)) return false;
        record.btn?.classList.remove('is-open', 'has-minimized', 'is-bouncing');
        delete this._openWindows[section];
        this._host._emit('window:close', { section, win });
        if (!suppressSessionSave) this._host._saveSession();
        return true;
    }

    public setWindowLogicalState(win: WindowElement, minimized?: boolean, zoomed?: boolean): void {
        const rec = this._recordFor(win);
        if (!rec) return;
        rec.transitionVersion += 1;
        if (minimized !== undefined) {
            rec.minimized = minimized;
            win.classList.toggle('is-minimized', minimized);
            win.classList.toggle('is-gone', minimized);
            rec.btn?.classList.toggle('has-minimized', minimized);
        }
        if (zoomed !== undefined) {
            rec.zoomed = zoomed;
            win.classList.toggle('is-zoomed', zoomed);
        }
        win.classList.remove('is-animating-minimize', 'is-animating-restore', 'is-animating-maximize');
        win.style.transform = '';
    }

    public isMinimized(recordOrWindow: WindowRecord | WindowElement): boolean {
        const rec = 'el' in recordOrWindow ? recordOrWindow : this._recordFor(recordOrWindow);
        return rec?.minimized ?? false;
    }

    public isZoomed(recordOrWindow: WindowRecord | WindowElement): boolean {
        const rec = 'el' in recordOrWindow ? recordOrWindow : this._recordFor(recordOrWindow);
        return rec?.zoomed ?? false;
    }

    private _recordFor(win: WindowElement): WindowRecord | undefined {
        const section = win.getAttribute('data-section') ?? '';
        const rec = this._openWindows[section];
        return rec?.el === win ? rec : undefined;
    }

    private _isCurrent(section: string, record: WindowRecord): boolean {
        return this._openWindows[section] === record;
    }

    private _disposeWindow(win: WindowElement): void {
        if (!win._disposal) return;
        win._disposal.dispose();
        win._disposal = null;
    }

    /** Remove the shared snap-preview element (engine destroy). */
    public disposeSnapPreview(): void {
        if (this._snapPreviewEl) { this._snapPreviewEl.remove(); this._snapPreviewEl = null; }
    }

    /** Replace content of a window body (returns the content element if present). */
    public setWindowTitle(win: WindowElement, title: string): void {
        const t = win ? win.querySelector('.window-title') : null;
        if (t) {
            const icon = t.querySelector('.window-title-icon');
            while (t.firstChild) t.removeChild(t.firstChild);
            if (icon) t.appendChild(icon.cloneNode(true));
            t.append(document.createTextNode(title));
        }
    }

    public setWindowContent(win: WindowElement, content: Node | string): void {
        const main = win ? win.querySelector<HTMLElement>('.window-content-main') : null;
        if (main) replaceContent(main, content, false);
    }

    public getWindowContent(win: WindowElement): HTMLElement | null {
        return win ? win.querySelector('.window-content-main') : null;
    }

    /** Internal: read the app manifest for a section. */
    private _appConfig(section: string): AppManifest | undefined {
        const apps = this._host.config.apps;
        return apps && Object.prototype.hasOwnProperty.call(apps, section) ? apps[section] : undefined;
    }
}
