/**
 * Regression suite for the production-readiness review patches:
 * 1. closeAllWindows / explodeAndCloseAll dispose every window DisposalStack
 * 2. touch-driven window drag & resize
 * 3. multi-point isElementVisuallySafe (center + inset corners)
 * 4. encrypted store restore never clobbers writes equal to initialState
 * 5. dropdown / modal / drawer self-cleanup on external DOM removal
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prestige } from '../../src/core/DesktopEngine.js';
import { PrestigeStore } from '../../src/core/Store.js';
import type { WindowManager } from '../../src/core/WindowManager.js';
import { isElementVisuallySafe } from '../../src/ui/Dialogs.js';
import { createDropdown, createModal, createDrawer } from '../../src/ui/Components.js';
import { installMemoryStorage } from '../helpers/memoryStorage.js';
import { mockRect } from '../helpers/mockLayout.js';
import { TestHost } from '../helpers/testHost.js';

function mountDesktop(): void {
    document.body.replaceChildren();
    const canvas = document.createElement('div');
    canvas.id = 'desktop-canvas';
    document.body.appendChild(canvas);
}

async function flushAsync(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function touchLike(type: string, x: number, y: number): Event {
    const ev = new Event(type, { cancelable: true, bubbles: true });
    Object.defineProperty(ev, 'touches', { value: [{ clientX: x, clientY: y }] });
    return ev;
}

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe('closeAllWindows disposes window resources', () => {
    it('runs every DisposalStack when closing all windows without animation', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false });
        const win = engine.openWindow('a')!;
        const winB = engine.openWindow('b')!;
        const intervalA = win._disposal!.setInterval(() => {}, 1000);
        const intervalB = winB._disposal!.setInterval(() => {}, 1000);
        const clearSpy = vi.spyOn(window, 'clearInterval');

        engine.closeAllWindows();

        expect(clearSpy).toHaveBeenCalledWith(intervalA);
        expect(clearSpy).toHaveBeenCalledWith(intervalB);
        expect(win._disposal).toBeNull();
        expect(winB._disposal).toBeNull();
        expect(document.querySelectorAll('.window').length).toBe(0);
        engine.destroy();
    });

    it('disposes resources in the explodeAndCloseAll animation-disabled fallback', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false, particleExplosion: true });
        const win = engine.openWindow('a')!;
        const interval = win._disposal!.setInterval(() => {}, 1000);
        const clearSpy = vi.spyOn(window, 'clearInterval');

        engine.explodeAndCloseAll();

        expect(clearSpy).toHaveBeenCalledWith(interval);
        expect(win._disposal).toBeNull();
        expect(document.querySelectorAll('.window').length).toBe(0);
        engine.destroy();
    });
});

describe('touch-driven window gestures', () => {
    it('drags a window from touchstart/touchmove/touchend', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false, snap: false, shakeToMinimize: false, flickToMinimize: false });
        const win = engine.openWindow('a')!;
        const wm = (engine as unknown as { _wm: WindowManager })._wm;
        const originalLeft = parseInt(win.style.left, 10);

        wm.startDrag(win, touchLike('touchstart', 100, 100) as unknown as TouchEvent);
        expect(win.classList.contains('is-dragging')).toBe(true);

        document.dispatchEvent(touchLike('touchmove', 160, 140));
        document.dispatchEvent(touchLike('touchend', 160, 140));

        expect(win.classList.contains('is-dragging')).toBe(false);
        expect(parseInt(win.style.left, 10)).not.toBe(originalLeft);
        engine.destroy();
    });

    it('resizes a window from touch input via the se handle', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false });
        const win = engine.openWindow('a')!;
        const wm = (engine as unknown as { _wm: WindowManager })._wm;
        const originalW = parseInt(win.style.width, 10);
        const originalH = parseInt(win.style.height, 10);

        wm.startResize(win, touchLike('touchstart', 100, 100) as unknown as TouchEvent, 'se');
        document.dispatchEvent(touchLike('touchmove', 160, 160));
        document.dispatchEvent(touchLike('touchend', 160, 160));

        expect(parseInt(win.style.width, 10)).toBe(originalW + 60);
        expect(parseInt(win.style.height, 10)).toBe(originalH + 60);
        engine.destroy();
    });
});

describe('minimized-preview restores window geometry', () => {
    function installDock(): HTMLElement {
        const dock = document.createElement('div');
        dock.id = 'dock';
        document.body.appendChild(dock);
        const btn = document.createElement('button');
        btn.className = 'dock-item';
        btn.setAttribute('data-section', 'app');
        btn.setAttribute('data-icon', 'blocks');
        btn.setAttribute('data-label', 'App');
        dock.appendChild(btn);
        return btn;
    }

    it('restores a window minimized via the titlebar button to its last position on dock click', async () => {
        mountDesktop();
        installMemoryStorage();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] });
        try {
            installDock();
            const engine = new Prestige({ animations: true, session: false, minimizedPreview: true, dock: true });
            engine.init();
            engine.registerApp('app', {
                title: 'App', icon: 'blocks', placement: 'dock',
                content: () => document.createElement('div'),
            });
            const btn = document.querySelector<HTMLElement>('.dock-item[data-section="app"]')!;

            const win = engine.openWindow('app', 'blocks', 'App', btn);
            await vi.advanceTimersByTimeAsync(16);
            await vi.advanceTimersByTimeAsync(16);
            await vi.advanceTimersByTimeAsync(400);
            if (!win) return;

            const origLeft = win.style.left;
            const origTop = win.style.top;

            // Minimize via the window minimize button.
            const minimizeBtn = win.querySelector('[data-act="minimize"]') as HTMLButtonElement;
            minimizeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await vi.advanceTimersByTimeAsync(16);
            await vi.advanceTimersByTimeAsync(400);
            expect(win.classList.contains('is-minimized')).toBe(true);

            // Hover the dock icon: preview shows and temporarily moves the window.
            btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            expect(win.classList.contains('is-preview')).toBe(true);
            expect(win.style.left).not.toBe(origLeft);

            // Click the dock icon: preview is dismissed and the window is restored in place.
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await vi.advanceTimersByTimeAsync(16);
            await vi.advanceTimersByTimeAsync(400);
            expect(win.classList.contains('is-minimized')).toBe(false);
            expect(win.classList.contains('is-gone')).toBe(false);
            expect(win.classList.contains('is-preview')).toBe(false);
            expect(win.style.left).toBe(origLeft);
            expect(win.style.top).toBe(origTop);
            await vi.advanceTimersByTimeAsync(800);
            engine.destroy();
        } finally {
            vi.useRealTimers();
        }
    });

    it('minimizing and restoring twice keeps the original geometry', async () => {
        mountDesktop();
        installMemoryStorage();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] });
        try {
            installDock();
            const engine = new Prestige({ animations: true, session: false, minimizedPreview: true, dock: true });
            engine.init();
            engine.registerApp('app', {
                title: 'App', icon: 'blocks', placement: 'dock',
                content: () => document.createElement('div'),
            });
            const btn = document.querySelector<HTMLElement>('.dock-item[data-section="app"]')!;

            const win = engine.openWindow('app', 'blocks', 'App', btn);
            await vi.advanceTimersByTimeAsync(16);
            await vi.advanceTimersByTimeAsync(16);
            await vi.advanceTimersByTimeAsync(400);
            if (!win) return;

            const origLeft = win.style.left;
            const origTop = win.style.top;

            for (let cycle = 0; cycle < 2; cycle++) {
                // Minimize via the dock icon while displayed.
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                await vi.advanceTimersByTimeAsync(16);
                await vi.advanceTimersByTimeAsync(400);
                expect(win.classList.contains('is-minimized')).toBe(true);

                // Hover (preview) then restore via dock click.
                btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                await vi.advanceTimersByTimeAsync(16);
                await vi.advanceTimersByTimeAsync(400);
                expect(win.classList.contains('is-minimized')).toBe(false);
                expect(win.style.left).toBe(origLeft);
                expect(win.style.top).toBe(origTop);
            }
            await vi.advanceTimersByTimeAsync(800);
            engine.destroy();
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('isElementVisuallySafe multi-point sampling', () => {
    it('rejects when a foreign overlay obscures only the corners', () => {
        const el = document.createElement('button');
        document.body.appendChild(el);
        mockRect(el, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        const overlay = document.createElement('div');
        document.body.appendChild(overlay);
        const original = document.elementFromPoint;
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: (x: number, y: number) => (x === 70 && y === 30 ? el : overlay),
        });
        try {
            expect(isElementVisuallySafe(el)).toBe(false);
        } finally {
            Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: original });
        }
    });

    it('accepts its own ancestor container at the corners (rounded-button chrome)', () => {
        const el = document.createElement('button');
        document.body.appendChild(el);
        mockRect(el, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        const original = document.elementFromPoint;
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: (x: number, y: number) => (x === 70 && y === 30 ? el : document.body),
        });
        try {
            // The button's own ancestors are its structural chrome (rounded
            // corners land corner samples on the parent container), not a
            // malicious overlay — a foreign element cannot become an ancestor
            // without mutating the watched overlay subtree.
            expect(isElementVisuallySafe(el)).toBe(true);
        } finally {
            Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: original });
        }
    });

    it('passes when the element is topmost at every sample point', () => {
        const el = document.createElement('button');
        document.body.appendChild(el);
        mockRect(el, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        const original = document.elementFromPoint;
        Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => el });
        try {
            expect(isElementVisuallySafe(el)).toBe(true);
        } finally {
            Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: original });
        }
    });
});

describe('isElementVisuallySafe inert pointer-events overlays', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function mountButton(): HTMLButtonElement {
        const el = document.createElement('button');
        document.body.appendChild(el);
        mockRect(el, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        // Hit testing returns the button at every sample point (as if no
        // pointer-events:auto overlay exists), so only the inert-overlay scan
        // decides the outcome.
        Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => el });
        return el;
    }

    it('rejects a pointer-events:none decoy covering the button', () => {
        const el = mountButton();
        const decoy = document.createElement('div');
        decoy.className = 'decoy';
        document.body.appendChild(decoy);
        mockRect(decoy, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        vi.stubGlobal('getComputedStyle', (node: Element) => {
            const isDecoy = node.classList.contains('decoy');
            return {
                pointerEvents: isDecoy ? 'none' : 'auto',
                position: isDecoy ? 'fixed' : 'static',
                visibility: 'visible',
                opacity: '',
                zIndex: isDecoy ? '999999' : 'auto',
            } as unknown as CSSStyleDeclaration;
        });

        expect(isElementVisuallySafe(el)).toBe(false);
    });

    it('rejects an inert decoy whose z-index is below the security plane', () => {
        const el = mountButton();
        const decoy = document.createElement('div');
        decoy.className = 'decoy-low';
        document.body.appendChild(decoy);
        mockRect(decoy, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        vi.stubGlobal('getComputedStyle', (node: Element) => ({
            pointerEvents: 'none',
            position: 'fixed',
            visibility: 'visible',
            opacity: '',
            zIndex: node.classList.contains('decoy-low') ? '100' : 'auto',
        } as unknown as CSSStyleDeclaration));

        expect(isElementVisuallySafe(el)).toBe(false);
    });

    it('rejects a top-layer dialog decoy whose z-index is auto', () => {
        const el = mountButton();
        const decoy = document.createElement('dialog');
        decoy.className = 'decoy-top-layer';
        decoy.setAttribute('open', '');
        document.body.appendChild(decoy);
        mockRect(decoy, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        vi.stubGlobal('getComputedStyle', (node: Element) => ({
            pointerEvents: node.classList.contains('decoy-top-layer') ? 'none' : 'auto',
            position: node.classList.contains('decoy-top-layer') ? 'fixed' : 'static',
            display: 'block',
            visibility: 'visible',
            opacity: '',
            zIndex: 'auto',
        } as unknown as CSSStyleDeclaration));

        expect(isElementVisuallySafe(el)).toBe(false);
    });

    it('allows inert structural chrome within the protected security overlay', () => {
        const overlay = document.createElement('div');
        overlay.className = 'prestige-security-overlay';
        document.body.appendChild(overlay);
        const el = mountButton();
        overlay.appendChild(el);
        const chrome = document.createElement('div');
        chrome.className = 'guard-chrome';
        overlay.appendChild(chrome);
        mockRect(chrome, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        vi.stubGlobal('getComputedStyle', (node: Element) => ({
            pointerEvents: node.classList.contains('guard-chrome') ? 'none' : 'auto',
            position: 'static',
            display: 'block',
            visibility: 'visible',
            opacity: '',
            zIndex: 'auto',
        } as unknown as CSSStyleDeclaration));

        expect(isElementVisuallySafe(el)).toBe(true);
    });

    it('passes when the overlapping element is not pointer-events:none', () => {
        const el = mountButton();
        const decoy = document.createElement('div');
        decoy.className = 'decoy-auto';
        document.body.appendChild(decoy);
        mockRect(decoy, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        vi.stubGlobal('getComputedStyle', () => ({
            pointerEvents: 'auto',
            position: 'fixed',
            visibility: 'visible',
            opacity: '',
            zIndex: '999999',
        } as unknown as CSSStyleDeclaration));

        // pe:auto overlays are the responsibility of elementFromPoint (which is
        // mocked to return the button here); the inert scan must not flag them.
        expect(isElementVisuallySafe(el)).toBe(true);
    });
});

describe('encrypted restore write-race edge', () => {
    const KEY_A = { kind: 'a' } as unknown as CryptoKey;

    function installFakeCrypto(): void {
        vi.stubGlobal('crypto', {
            getRandomValues: (arr: Uint8Array): Uint8Array => {
                for (let i = 0; i < arr.length; i++) arr[i] = (i * 7) % 256;
                return arr;
            },
            subtle: {
                encrypt: vi.fn(async (_alg: unknown, _key: unknown, data: ArrayBuffer): Promise<ArrayBuffer> => data),
                decrypt: vi.fn(async (_alg: unknown, _key: unknown, data: ArrayBuffer): Promise<ArrayBuffer> => data),
            },
        });
    }

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('never clobbers a caller write that equals the initialState value', async () => {
        installMemoryStorage();
        installFakeCrypto();

        const store1 = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_A });
        const proxy1 = store1.createStore('x', { a: 1 }, { persistKey: 'data' });
        proxy1.a = 2;
        await flushAsync();

        const store2 = new PrestigeStore({ storage: 'encrypted', keyProvider: async () => KEY_A });
        const proxy2 = store2.createStore('x', { a: 1 }, { persistKey: 'data' });
        proxy2.a = 1;
        await flushAsync();
        expect(proxy2.a).toBe(1);
    });
});

describe('component self-cleanup on external removal', () => {
    it('dropdown disconnects each observer and never installs a listener after close()', async () => {
        const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');
        const addSpy = vi.spyOn(document, 'addEventListener');
        const dropdown = createDropdown({ items: [{ label: 'A' }] });
        document.body.appendChild(dropdown);
        const trigger = dropdown.querySelector<HTMLButtonElement>('button');

        trigger?.click();
        expect(dropdown.isOpen()).toBe(true);
        dropdown.close();
        const clickListenersAfterClose = addSpy.mock.calls.filter(([type]) => type === 'click').length;
        await flushAsync();
        expect(addSpy.mock.calls.filter(([type]) => type === 'click')).toHaveLength(clickListenersAfterClose);
        expect(disconnectSpy).toHaveBeenCalledTimes(1);

        trigger?.click();
        dropdown.close();
        expect(disconnectSpy).toHaveBeenCalledTimes(2);
    });

    it('dropdown drops its document click listener and closes when detached', async () => {
        const dropdown = createDropdown({ items: [{ label: 'A' }] });
        document.body.appendChild(dropdown);
        dropdown.querySelector<HTMLButtonElement>('button')?.click();
        expect(dropdown.isOpen()).toBe(true);

        dropdown.remove();
        await flushAsync();
        document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await flushAsync();
        expect(dropdown.isOpen()).toBe(false);
    });

    it('modal detachment cleans its listener and settles once with closeValue/detach', async () => {
        const host = new TestHost();
        const onClose = vi.fn();
        const promise = createModal({ title: 'T', body: 'body', closeValue: 'detached', onClose }, host);
        await flushAsync();
        const overlay = document.querySelector('.prestige-custom-modal-overlay');
        expect(overlay).not.toBeNull();
        overlay?.remove();
        await flushAsync();
        await expect(promise).resolves.toBe('detached');
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledWith('detached', 'detach');

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await flushAsync();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('drawer detachment cleans its listener and closes once with detach', async () => {
        const host = new TestHost();
        const onClose = vi.fn();
        const api = createDrawer({ title: 'D', content: 'x', onClose }, host);
        await flushAsync();
        api.element.closest('.prestige-drawer-overlay')?.remove();
        await flushAsync();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledWith('detach');

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        api.close();
        await flushAsync();
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
