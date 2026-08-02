import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prestige } from '../../src/core/DesktopEngine.js';
import { DisposalStack, Owned } from '../../src/core/Memory.js';
import type { WindowManager } from '../../src/core/WindowManager.js';
import type { AppManifest, SecurityOptions, WindowState } from '../../src/types/desktop.js';
import { installMemoryStorage } from '../helpers/memoryStorage.js';

function mountDesktop(withChrome = false): void {
    document.body.replaceChildren();
    const canvas = document.createElement('div');
    canvas.id = 'desktop-canvas';
    document.body.appendChild(canvas);
    if (!withChrome) return;

    const dock = document.createElement('div');
    dock.id = 'dock';
    const group = document.createElement('div');
    group.className = 'dock-group';
    dock.appendChild(group);
    document.body.appendChild(dock);

    const menubar = document.createElement('div');
    menubar.className = 'menubar';
    const right = document.createElement('div');
    right.className = 'menubar-right';
    menubar.appendChild(right);
    document.body.appendChild(menubar);
}

function state(id: string, overrides: Partial<WindowState> = {}): WindowState {
    return {
        id,
        x: 11,
        y: 22,
        w: 633,
        h: 411,
        minimized: false,
        zoomed: false,
        title: id,
        ...overrides,
    };
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
});

describe('constructor registry and security isolation', () => {
    it('uses null-prototype own manifests and does not mutate Object through constructor app IDs', () => {
        mountDesktop();
        installMemoryStorage();
        const inheritedContent = vi.fn(() => document.createElement('div'));
        const ownContent = vi.fn(() => document.createElement('div'));
        const apps = Object.create({ inherited: { id: 'inherited', title: 'Inherited', content: inheritedContent } }) as Record<string, AppManifest>;
        apps.own = { id: 'own', title: 'Own', content: ownContent };
        const engine = new Prestige({ animations: false, apps });

        expect(Object.getPrototypeOf(engine.config.apps)).toBeNull();
        expect(Object.prototype.hasOwnProperty.call(engine.config.apps, 'inherited')).toBe(false);
        engine.openWindow('inherited');
        expect(inheritedContent).not.toHaveBeenCalled();

        engine.registerApp('constructor', { title: 'Safe', content: ownContent });
        expect(Object.getPrototypeOf(engine.config.apps?.constructor)).toBeNull();
        expect((Object as unknown as { title?: string }).title).toBeUndefined();

        apps.own = { id: 'own', title: 'Mutated', content: inheritedContent };
        engine.openWindow('own');
        expect(ownContent).toHaveBeenCalledOnce();
        expect(inheritedContent).not.toHaveBeenCalled();
        engine.destroy();
    });

    it('clones and freezes security while retaining callable hooks', () => {
        mountDesktop();
        const sanitizer = vi.fn((dirty: string) => {
            const fragment = document.createDocumentFragment();
            fragment.append(dirty);
            return fragment;
        });
        const storageKeyProvider = vi.fn(async () => null);
        const security: SecurityOptions = { sanitizer, storage: 'encrypted', storageKeyProvider, clickjackCheck: true };
        const engine = new Prestige({ security });

        (security as { clickjackCheck?: boolean }).clickjackCheck = false;
        expect(engine.config.security?.clickjackCheck).toBe(true);
        expect(engine.config.security?.sanitizer).toBe(sanitizer);
        expect(engine.config.security?.storageKeyProvider).toBe(storageKeyProvider);
        expect(Object.isFrozen(engine.config.security)).toBe(true);
        expect(Object.isFrozen(engine.config)).toBe(true);
        engine.destroy();
    });
});

describe('safe rendering and content roots', () => {
    it('sanitizes string titlebar renderers while preserving Node renderers', () => {
        mountDesktop();
        installMemoryStorage();
        const stringEngine = new Prestige({
            animations: false,
            renderTitlebar: () => '<div class="window-titlebar"><span>Safe</span><script>globalThis.pwned = true</script></div>',
        });
        const stringWin = stringEngine.openWindow('string-title')!;
        expect(stringWin.querySelector('.window-titlebar')).not.toBeNull();
        expect(stringWin.querySelector('script')).toBeNull();
        stringEngine.destroy();

        mountDesktop();
        const node = document.createElement('div');
        node.className = 'window-titlebar node-titlebar';
        const nodeEngine = new Prestige({ animations: false, renderTitlebar: () => node });
        const nodeWin = nodeEngine.openWindow('node-title')!;
        expect(nodeWin.querySelector('.node-titlebar')).toBe(node);
        nodeEngine.destroy();
    });

    it('wraps registered custom content in window-content-main for set/get APIs', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false });
        engine.registerApp('custom', { title: 'Custom', placement: 'hidden', content: () => document.createElement('article') });
        const win = engine.openWindow('custom')!;
        const main = engine.getWindowContent(win);
        expect(main?.querySelector('article')).not.toBeNull();
        engine.setWindowContent(win, 'replacement');
        expect(main?.textContent).toBe('replacement');
        engine.destroy();
    });
});

describe('logical state and identity-safe lifecycle', () => {
    it('hydrates exact custom-app state synchronously and saves only the coherent result', async () => {
        mountDesktop();
        const storage = installMemoryStorage();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
        const content = vi.fn(() => document.createElement('section'));
        const engine = new Prestige({ animations: true, apps: { custom: { id: 'custom', title: 'Manifest title', icon: 'box', content } } });
        const old = engine.openWindow('old')!;
        expect(engine.getState()[0]?.minimized).toBe(false);
        const setItem = vi.spyOn(storage, 'setItem');
        setItem.mockClear();

        engine.setState([state('custom', { x: 0, y: 7, w: 701, h: 377, minimized: true, zoomed: true, title: 'Saved title' })]);

        const restored = document.querySelector<HTMLElement>('.window[data-section="custom"]')!;
        expect(old.isConnected).toBe(false);
        expect(restored.style.cssText).toContain('left: 0px');
        expect(restored.style.top).toBe('7px');
        expect(restored.style.width).toBe('701px');
        expect(restored.style.height).toBe('377px');
        expect(restored.classList.contains('is-minimized')).toBe(true);
        expect(restored.classList.contains('is-zoomed')).toBe(true);
        expect(restored.querySelector('.window-content-main section')).not.toBeNull();
        expect(content).toHaveBeenCalledOnce();
        expect(engine.getState()[0]).toMatchObject({ minimized: true, zoomed: true, title: 'Saved title', icon: 'box' });
        expect(setItem.mock.calls.filter(([key]) => key === 'prestige_session')).toHaveLength(1);

        await vi.runAllTimersAsync();
        expect(document.querySelector('.window[data-section="custom"]')).toBe(restored);
        engine.destroy();
    });

    it('does not let an old animated close callback delete a replacement record', async () => {
        mountDesktop();
        installMemoryStorage();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
        const engine = new Prestige({ animations: true });
        const old = engine.openWindow('same')!;
        await vi.advanceTimersByTimeAsync(450);
        engine.closeWindow(old);
        const replacement = engine.openWindow('same')!;

        await vi.advanceTimersByTimeAsync(500);
        expect(old.isConnected).toBe(false);
        expect(replacement.isConnected).toBe(true);
        expect(engine.getState()).toHaveLength(1);
        engine.destroy();
    });

    it('focuses a visible background window and only dock-toggles an already-focused one', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false });
        const first = engine.openWindow('first')!;
        engine.openWindow('second');

        expect(engine.openWindow('first')).toBe(first);
        expect(first.classList.contains('is-focused')).toBe(true);
        expect(engine.getState().find((item) => item.id === 'first')?.minimized).toBe(false);

        expect(engine.openWindow('first')).toBe(first);
        expect(engine.getState().find((item) => item.id === 'first')?.minimized).toBe(true);
        engine.destroy();
    });

    it('falls back to synchronous closing when the particle canvas has no 2D context', () => {
        mountDesktop();
        installMemoryStorage();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
        const engine = new Prestige({ animations: true, particleExplosion: true });
        engine.openWindow('one');
        engine.openWindow('two');
        engine.closeAllWindows();
        expect(document.querySelectorAll('.window')).toHaveLength(0);
        expect(engine.getState()).toHaveLength(0);
        engine.destroy();
    });
});

describe('keyboard and Spotlight behavior', () => {
    it('does not run disabled shortcut or keyup branches when keyboard binding exists for another feature', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({
            animations: false,
            search: false,
            windowSwitcher: false,
            xray: false,
            expose: true,
            lockScreen: false,
            tiling: false,
            snap: false,
        });
        const search = vi.spyOn(engine, 'showSearch');
        const xray = vi.spyOn(engine, 'enableXRay');
        const disableXray = vi.spyOn(engine, 'disableXRay');
        const lock = vi.spyOn(engine, 'lock');
        const snap = vi.spyOn((engine as unknown as { _wm: WindowManager })._wm, '_applySnapOnRelease');
        engine.init();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', ctrlKey: true, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', key: 'x', altKey: true, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, shiftKey: true, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', key: 'x', bubbles: true }));

        expect(search).not.toHaveBeenCalled();
        expect(xray).not.toHaveBeenCalled();
        expect(disableXray).not.toHaveBeenCalled();
        expect(lock).not.toHaveBeenCalled();
        expect(snap).not.toHaveBeenCalled();
        engine.destroy();
    });

    it('updates Spotlight selection so ArrowDown followed by Enter opens the result', async () => {
        mountDesktop();
        installMemoryStorage();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
        const engine = new Prestige({
            animations: false,
            apps: { alpha: { id: 'alpha', title: 'Alpha', label: 'Alpha', content: () => document.createElement('div') } },
        });
        engine.init();
        const open = vi.spyOn(engine, 'openWindow');
        engine.showSearch();
        const input = document.querySelector<HTMLInputElement>('.search-input')!;
        input.value = 'alp';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await vi.advanceTimersByTimeAsync(150);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(open).toHaveBeenCalledWith('alpha', undefined, 'Alpha', null);
        engine.destroy();
    });
});

describe('resource, iframe, geometry, placement, and teardown guards', () => {
    it('rejects late DisposalStack registrations and immediately disposes resources owned after close', () => {
        const stack = new DisposalStack('closed');
        stack.dispose();
        expect(() => stack.defer(() => {})).toThrow(/disposed DisposalStack/);
        const ownedDisposer = vi.fn();
        const lateOwned = new Owned('late', ownedDisposer);
        stack.own(lateOwned);
        expect(ownedDisposer).toHaveBeenCalledOnce();

        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false });
        const win = engine.openWindow('resource')!;
        engine.closeWindow(win);
        const disposer = vi.fn();
        const owned = engine.ownResource(win, { id: 1 }, disposer);
        expect(disposer).toHaveBeenCalledOnce();
        expect(owned.isAlive()).toBe(false);
        engine.destroy();
    });

    it('creates and closes a fresh MessageChannel for every isolated-frame load using validated src', () => {
        mountDesktop();
        installMemoryStorage();
        const channels: Array<{ port1: { close: ReturnType<typeof vi.fn> }; port2: { close: ReturnType<typeof vi.fn> } }> = [];
        class FakeMessageChannel {
            public readonly port1 = { close: vi.fn() };
            public readonly port2 = { close: vi.fn() };
            public constructor() { channels.push(this); }
        }
        vi.stubGlobal('MessageChannel', FakeMessageChannel);
        const resolver = vi.fn(() => 'https://target.example');
        const engine = new Prestige({
            animations: false,
            security: { postTargetOrigin: resolver },
            apps: { frame: { id: 'frame', title: 'Frame', tier: 'isolated', src: 'javascript:alert(1)' } },
        });
        const win = engine.openWindow('frame')!;
        const iframe = win.querySelector<HTMLIFrameElement>('iframe')!;
        const contentWindow = iframe.contentWindow;
        if (contentWindow) vi.spyOn(contentWindow, 'postMessage').mockImplementation(() => {});

        iframe.dispatchEvent(new Event('load'));
        const first = channels.at(-1)!;
        iframe.dispatchEvent(new Event('load'));
        const second = channels.at(-1)!;
        expect(second).not.toBe(first);
        expect(first.port1.close).toHaveBeenCalledOnce();
        expect(first.port2.close).toHaveBeenCalledOnce();
        expect(resolver).toHaveBeenLastCalledWith(iframe.sandbox.value, 'about:blank', expect.any(String));

        engine.closeWindow(win);
        expect(second.port1.close).toHaveBeenCalledOnce();
        expect(second.port2.close).toHaveBeenCalledOnce();
        engine.destroy();
    });

    it('keeps north-edge resize height non-negative and at the feasible minimum', () => {
        mountDesktop();
        installMemoryStorage();
        const engine = new Prestige({ animations: false });
        const win = engine.openWindow('resize')!;
        const wm = (engine as unknown as { _wm: WindowManager })._wm;
        wm.startResize(win, new MouseEvent('mousedown', { clientX: 100, clientY: 100 }), 'n');
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 5000 }));
        document.dispatchEvent(new MouseEvent('mouseup'));
        expect(parseFloat(win.style.height)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(win.style.height)).toBe(280);
        engine.destroy();
    });

    it('applies persisted placement on init and rebinds an open record to the replacement button', () => {
        mountDesktop(true);
        installMemoryStorage().setItem('prestige_placements', JSON.stringify({ app: 'topdock' }));
        const engine = new Prestige({
            animations: false,
            dockDragDrop: false,
            apps: { app: { id: 'app', title: 'Application', icon: 'box', placement: 'dock', content: () => document.createElement('div') } },
        });
        engine.init();
        const topButton = document.querySelector<HTMLElement>('.menubar-dock-item[data-section="app"]')!;
        expect(topButton.dataset.label).toBe('Application');
        const win = engine.openWindow('app', 'box', 'Application', topButton)!;

        engine.setAppPlacement('app', 'dock');
        const dockButton = document.querySelector<HTMLElement>('#dock .dock-group > .dock-item[data-section="app"]')!;
        const record = (engine as unknown as { _wm: WindowManager })._wm.getOpenWindow('app');
        expect(record?.btn).toBe(dockButton);
        expect(dockButton.classList.contains('is-open')).toBe(true);
        expect(topButton.isConnected).toBe(false);
        expect(win.isConnected).toBe(true);
        engine.destroy();
    });

    it('clears lock timers, content cache, and owned transient-node bookkeeping on destroy', () => {
        mountDesktop();
        installMemoryStorage();
        const clearInterval = vi.spyOn(window, 'clearInterval');
        const engine = new Prestige({ animations: false, lockScreen: true });
        engine.init();
        engine.cacheContent('key', 'value');
        engine.lock();
        engine.showContextMenu({ items: [{ label: 'Item' }] });
        const menu = document.querySelector('.ctx-menu')!;
        const ownedNodes = (engine as unknown as { _ownedNodes: Set<Node> })._ownedNodes;
        expect(ownedNodes.has(menu)).toBe(true);

        engine.destroy();
        expect(clearInterval).toHaveBeenCalled();
        expect(engine.getCachedContent('key')).toBeNull();
        expect(document.querySelector('#lock-screen')).toBeNull();
        expect(ownedNodes.size).toBe(0);
    });
});
