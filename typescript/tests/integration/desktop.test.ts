/**
 * Phase 5 integration verification: window lifecycle, FLIP animation class
 * sequences, App Isolation Tiers, and a 50-window zero-leak stress test.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prestige } from '../../src/core/DesktopEngine.js';
import type { WindowElement } from '../../src/core/WindowManager.js';
import { installMemoryStorage } from '../helpers/memoryStorage.js';

function mountDesktop(): void {
    document.body.replaceChildren();
    const canvas = document.createElement('div');
    canvas.id = 'desktop-canvas';
    document.body.appendChild(canvas);
}

function trackTargetListeners(): { countFor(target: object): number; restore(): void } {
    const origAdd = EventTarget.prototype.addEventListener;
    const origRemove = EventTarget.prototype.removeEventListener;
    const net = new WeakMap<object, number>();
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
        net.set(this, (net.get(this) ?? 0) + 1);
        return origAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
        net.set(this, (net.get(this) ?? 0) - 1);
        return origRemove.call(this, type, listener, options);
    };
    return {
        countFor: (target: object) => net.get(target) ?? 0,
        restore: () => { EventTarget.prototype.addEventListener = origAdd; EventTarget.prototype.removeEventListener = origRemove; },
    };
}

function trackIntervals(): { snapshot(): number; restore(): void } {
    const active = new Set<number>();
    const origSet = window.setInterval.bind(window);
    const origClear = window.clearInterval.bind(window);
    const setSpy = vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        const id = origSet(handler, timeout, ...args);
        active.add(id);
        return id;
    }) as typeof window.setInterval);
    const clearSpy = vi.spyOn(window, 'clearInterval').mockImplementation(((id: number | undefined) => {
        if (id !== undefined) active.delete(id);
        return origClear(id);
    }) as typeof window.clearInterval);
    return {
        snapshot: () => active.size,
        restore: () => { setSpy.mockRestore(); clearSpy.mockRestore(); },
    };
}

afterEach(() => {
    document.body.replaceChildren();
});

describe('openWindow', () => {
    it('creates a valid window frame with a registered disposal stack', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false });
        engine.init();
        const win = engine.openWindow('overview', 'layout-dashboard', 'Overview');
        expect(win).toBeDefined();
        if (!win) return;
        expect(win.classList.contains('window')).toBe(true);
        expect(win.getAttribute('data-section')).toBe('overview');
        expect(win._disposal).toBeTruthy();
        expect(win.querySelector('.window-titlebar')).not.toBeNull();
        expect(win.querySelector('.window-title')).not.toBeNull();
        expect(win.querySelector('.window-controls')).not.toBeNull();
        expect(win.querySelector('.window-btn-minimize')).not.toBeNull();
        expect(win.querySelector('.window-btn-maximize')).not.toBeNull();
        expect(win.querySelector('.window-btn-close')).not.toBeNull();
        expect(win.querySelector('.window-body')).not.toBeNull();
        expect(win.querySelector('.window-resize-handle')).not.toBeNull();
        expect(win.querySelector('.window-content-main')).not.toBeNull();
        expect(win.style.left).not.toBe('');
        expect(win.style.width).not.toBe('');
        expect(document.querySelector('#desktop-canvas')?.contains(win)).toBe(true);
        expect(engine.getState()).toHaveLength(1);
        engine.destroy();
    });

    it('closeWindow removes the window from DOM and executes its disposal stack', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false });
        engine.init();
        const win = engine.openWindow('overview');
        expect(document.querySelectorAll('.window').length).toBe(1);
        engine.closeWindow(win as WindowElement);
        expect(document.querySelectorAll('.window').length).toBe(0);
        expect(engine.getState()).toHaveLength(0);
        expect((win as WindowElement)._disposal).toBeNull();
        engine.destroy();
    });

    it('honors AppManifest w/h window-size hints, falling back to defaults', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false });
        engine.registerApp('custom', {
            id: 'custom',
            title: 'Custom',
            content: () => document.createElement('div'),
            w: 960,
            h: 700,
        });
        const sized = engine.openWindow('custom');
        expect(sized?.style.width).toBe('960px');
        expect(sized?.style.height).toBe('700px');

        const fallback = engine.openWindow('overview');
        const defaults = fallback ? { w: parseInt(fallback.style.width, 10), h: parseInt(fallback.style.height, 10) } : null;
        expect(defaults).not.toBeNull();
        expect(defaults!.w).toBeGreaterThan(0);
        engine.destroy();
    });
});

describe('FLIP animation sequences', () => {
    it('minimize / restore / maximize follow exact class sequences', async () => {
        mountDesktop();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] });
        try {
            const engine = new Prestige({ animations: true, session: false });
            const win = engine.openWindow('notes', 'sticky-note', 'Notes');
            expect(win).toBeDefined();
            if (!win) return;

            // Complete the animated open sequence (nested rAFs + 400ms timeout).
            await vi.advanceTimersByTimeAsync(16);
            await vi.advanceTimersByTimeAsync(16);
            await vi.advanceTimersByTimeAsync(400);
            expect(win.classList.contains('is-minimized')).toBe(false);
            expect(win.classList.contains('is-animating-restore')).toBe(false);

            // Minimize: is-animating-minimize -> is-minimized -> is-gone.
            engine.minimizeWindow(win);
            expect(win.classList.contains('is-animating-minimize')).toBe(true);
            expect(win.style.getPropertyValue('--tx')).not.toBe('');
            expect(win.style.getPropertyValue('--ty')).not.toBe('');
            await vi.advanceTimersByTimeAsync(16);
            expect(win.classList.contains('is-minimized')).toBe(true);
            await vi.advanceTimersByTimeAsync(400);
            expect(win.classList.contains('is-gone')).toBe(true);
            expect(win.classList.contains('is-animating-minimize')).toBe(false);

            // Restore: is-animating-restore -> removal of is-minimized / is-gone.
            engine.restoreWindow(win);
            expect(win.classList.contains('is-animating-restore')).toBe(true);
            expect(win.classList.contains('is-minimized')).toBe(false);
            expect(win.classList.contains('is-gone')).toBe(false);
            await vi.advanceTimersByTimeAsync(400);
            expect(win.classList.contains('is-animating-restore')).toBe(false);

            // Maximize: dataset snapshot (rL/rT/rW/rH) + is-zoomed.
            engine.toggleMaximize(win);
            expect(win.classList.contains('is-zoomed')).toBe(true);
            expect(win.classList.contains('is-animating-maximize')).toBe(true);
            expect(win.dataset.rL).toBeDefined();
            expect(win.dataset.rT).toBeDefined();
            expect(win.dataset.rW).toBeDefined();
            expect(win.dataset.rH).toBeDefined();
            await vi.advanceTimersByTimeAsync(16);
            expect(win.classList.contains('is-animating-maximize')).toBe(false);
            expect(win.classList.contains('is-zoomed')).toBe(true);

            engine.closeWindow(win);
            await vi.advanceTimersByTimeAsync(200);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('App isolation tiers', () => {
    it('renders isolated-tier apps inside sandboxed iframes', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({
            animations: false,
            apps: {
                sandboxed: { id: 'sandboxed', title: 'Sandboxed', tier: 'isolated', src: 'about:blank' },
            },
        });
        const win = engine.openWindow('sandboxed', 'bot', 'Sandboxed');
        const iframe = win?.querySelector('iframe.prestige-app-sandbox');
        expect(iframe).not.toBeNull();
        expect(iframe?.getAttribute('sandbox')).toContain('allow-scripts');
        expect(iframe?.getAttribute('sandbox')).toContain('allow-forms');
        expect(iframe?.getAttribute('sandbox')).not.toContain('allow-same-origin');
        expect(win?.querySelector('.window-content-main')).toBeNull();
        engine.destroy();
    });

    it('renders native-tier apps directly into the DOM', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false });
        const win = engine.openWindow('overview');
        expect(win?.querySelector('iframe.prestige-app-sandbox')).toBeNull();
        expect(win?.querySelector('.window-content-main')).not.toBeNull();
        engine.destroy();
    });
});

describe('zero-leak stress test', () => {
    it('opening and closing 50 windows leaves no DOM nodes, intervals, or listeners behind', () => {
        mountDesktop();
        installMemoryStorage();
        const intervals = trackIntervals();
        const listeners = trackTargetListeners();
        const engine = new Prestige({
            animations: false,
            dock: false,
            topdock: false,
            dockDragDrop: false,
            search: false,
            windowSwitcher: false,
            expose: false,
            xray: false,
            lockScreen: false,
            tiling: false,
            grid: false,
            minimizedPreview: false,
            toastCenter: false,
        });
        engine.init();

        const nodeBaseline = document.querySelectorAll('*').length;
        const wins: WindowElement[] = [];
        for (let i = 0; i < 50; i++) {
            const win = engine.openWindow(`app-${i}`);
            if (win) wins.push(win);
        }
        expect(document.querySelectorAll('.window').length).toBe(50);
        expect(engine.getState()).toHaveLength(50);

        for (const win of wins) engine.closeWindow(win);

        expect(document.querySelectorAll('.window').length).toBe(0);
        expect(engine.getState()).toHaveLength(0);
        expect(wins.every((w) => w._disposal === null)).toBe(true);

        // Every listener registered on a window element was removed on close.
        for (const win of wins) {
            expect(listeners.countFor(win)).toBe(0);
        }
        listeners.restore();

        engine.destroy();
        expect(intervals.snapshot()).toBe(0);
        intervals.restore();

        // No leaked DOM nodes and no leftover system overlays.
        expect(document.querySelectorAll('*').length).toBe(nodeBaseline);
        expect(document.querySelectorAll('.snap-preview, #toast-center, #explosion-canvas, #expose-backdrop, .desktop-grid, #lock-screen').length).toBe(0);
    });
});

describe('app placement & context menu', () => {
    it('emits placement:changed when placement is changed and on reset', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false, dock: false, topdock: false });
        engine.init();
        const changed = vi.fn();
        engine.on('placement:changed', changed);

        engine.setAppPlacement('overview', 'hidden');
        expect(changed).toHaveBeenCalledWith({ appId: 'overview', placement: 'hidden' });
        expect(JSON.parse(localStorage.getItem('prestige_placements') ?? '{}')).toEqual({ overview: 'hidden' });

        engine.resetAppPlacement('overview');
        expect(changed).toHaveBeenLastCalledWith({ appId: 'overview', placement: 'dock' });
        expect(JSON.parse(localStorage.getItem('prestige_placements') ?? '{}')).toEqual({});
        engine.destroy();
    });

    it('right-clicking a dock item opens the placement context menu', () => {
        document.body.replaceChildren();
        installMemoryStorage();
        const canvas = document.createElement('div');
        canvas.id = 'desktop-canvas';
        document.body.appendChild(canvas);
        const dock = document.createElement('div');
        dock.id = 'dock';
        const group = document.createElement('div');
        group.className = 'dock-group';
        const item = document.createElement('button');
        item.className = 'dock-item';
        item.setAttribute('data-section', 'overview');
        group.appendChild(item);
        dock.appendChild(group);
        document.body.appendChild(dock);

        const engine = new Prestige({ animations: false, topdock: false, dockDragDrop: false });
        engine.init();

        item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 40 }));
        const menu = document.querySelector('.ctx-menu');
        expect(menu).not.toBeNull();
        const labels = Array.from(menu?.querySelectorAll('.ctx-item') ?? []).map((el) => el.textContent?.trim() ?? '');
        expect(labels.some((t) => t.includes('Dock'))).toBe(true);
        expect(labels.some((t) => t.includes('Top Dock'))).toBe(true);
        expect(labels.some((t) => t.includes('Hidden'))).toBe(true);
        expect(labels.some((t) => t.includes('Reset to default'))).toBe(true);

        const changed = vi.fn();
        engine.on('placement:changed', changed);
        const topdockItem = Array.from(menu?.querySelectorAll('.ctx-item') ?? []).find((el) => el.textContent?.includes('Top Dock'));
        (topdockItem as HTMLElement)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(changed).toHaveBeenCalledWith({ appId: 'overview', placement: 'topdock' });
        expect(document.querySelector('.ctx-menu')).toBeNull();
        engine.destroy();
    });
});

describe('window:focus payload', () => {
    it('includes the section in the emitted payload', () => {
        mountDesktop();
        installMemoryStorage();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        try {
            const engine = new Prestige({ animations: false });
            engine.init();
            const focused = vi.fn();
            engine.on('window:focus', focused);
            const win = engine.openWindow('overview', 'layout-dashboard', 'Overview');
            expect(focused).toHaveBeenCalledTimes(1);
            expect(focused.mock.calls[0][0]).toMatchObject({ win, section: 'overview' });
            engine.destroy();
            vi.advanceTimersByTime(100);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('closeAllWindows / particle explosion', () => {
    it('closeAllWindows removes every window without a particle canvas when disabled', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false, particleExplosion: true });
        engine.openWindow('a', 'circle', 'A');
        engine.openWindow('b', 'circle', 'B');
        expect(document.querySelectorAll('.window').length).toBe(2);
        engine.closeAllWindows();
        expect(document.querySelectorAll('.window').length).toBe(0);
        expect(engine.getState()).toHaveLength(0);
        expect(document.querySelector('#explosion-canvas')).toBeNull();
        engine.destroy();
    });
});
