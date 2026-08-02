/**
 * URL-scheme validation regression suite: `isSafeUrl` / `isSafeIframeSrc`,
 * avatar & breadcrumb `href` filtering, isolated-tier iframe `src` fallback,
 * and the web3 guard's document-level stylesheet tamper detection.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prestige } from '../../src/core/DesktopEngine.js';
import { isSafeUrl, isSafeIframeSrc } from '../../src/utils/sanitize.js';
import { web3TransactionGuard } from '../../src/ui/Dialogs.js';
import { createAvatar, createBreadcrumb } from '../../src/ui/Components.js';
import { installMemoryStorage } from '../helpers/memoryStorage.js';
import { TestHost } from '../helpers/testHost.js';

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe('isSafeUrl', () => {
    it('accepts http(s), mailto, tel, fragments and relative paths', () => {
        expect(isSafeUrl('https://example.com/a')).toBe(true);
        expect(isSafeUrl('http://example.com')).toBe(true);
        expect(isSafeUrl('mailto:user@example.com')).toBe(true);
        expect(isSafeUrl('tel:+15551234567')).toBe(true);
        expect(isSafeUrl('#section')).toBe(true);
        expect(isSafeUrl('/path/to/page')).toBe(true);
        expect(isSafeUrl('./relative')).toBe(true);
        expect(isSafeUrl('../up')).toBe(true);
    });

    it('rejects script-executing schemes', () => {
        expect(isSafeUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeUrl('data:text/html,<script>x</script>')).toBe(false);
        expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
        expect(isSafeUrl('  javascript:alert(1)')).toBe(false);
        expect(isSafeUrl('JaVaScRiPt:alert(1)')).toBe(false);
    });
});

describe('isSafeIframeSrc', () => {
    it('accepts about:blank, http(s) and relative paths', () => {
        expect(isSafeIframeSrc('about:blank')).toBe(true);
        expect(isSafeIframeSrc('https://app.example.com')).toBe(true);
        expect(isSafeIframeSrc('/apps/editor.html')).toBe(true);
        expect(isSafeIframeSrc('./editor.html')).toBe(true);
        expect(isSafeIframeSrc('../shared/app.html')).toBe(true);
        expect(isSafeIframeSrc(null)).toBe(true);
        expect(isSafeIframeSrc(undefined)).toBe(true);
    });

    it('rejects active-content and opaque protocols', () => {
        expect(isSafeIframeSrc('javascript:alert(1)')).toBe(false);
        expect(isSafeIframeSrc('data:text/html,<script>x</script>')).toBe(false);
        expect(isSafeIframeSrc('blob:https://x/y')).toBe(false);
        expect(isSafeIframeSrc('vbscript:msgbox(1)')).toBe(false);
    });
});

describe('avatar & breadcrumb href filtering', () => {
    it('uses initials instead of assigning an unsafe avatar image src', () => {
        const safe = createAvatar({ label: 'Ada Lovelace', src: 'https://example.com/ada.png' });
        expect(safe.querySelector('img')?.getAttribute('src')).toBe('https://example.com/ada.png');

        const unsafe = createAvatar({ label: 'Ada Lovelace', src: 'data:image/svg+xml,<svg onload=alert(1) />' });
        expect(unsafe.querySelector('img')).toBeNull();
        expect(unsafe.textContent).toBe('AL');
    });

    it('renders a span instead of a link for an unsafe avatar href', () => {
        const safe = createAvatar({ label: 'Ada', href: 'https://example.com/u/ada' });
        expect(safe.tagName).toBe('A');
        expect(safe.getAttribute('href')).toBe('https://example.com/u/ada');

        const unsafe = createAvatar({ label: 'Ada', href: 'javascript:alert(1)' });
        expect(unsafe.tagName).toBe('SPAN');
        expect(unsafe.hasAttribute('href')).toBe(false);
    });

    it('renders a span instead of a link for an unsafe breadcrumb href', () => {
        const safe = createBreadcrumb({ items: [{ label: 'Home', href: '/home' }, { label: 'Docs' }] });
        expect(safe.querySelector('a')?.getAttribute('href')).toBe('/home');

        const unsafe = createBreadcrumb({ items: [{ label: 'Home', href: 'javascript:alert(1)' }, { label: 'Docs' }] });
        expect(unsafe.querySelector('a')).toBeNull();
        expect(unsafe.textContent).toContain('Home');
    });
});

describe('isolated-tier iframe src validation', () => {
    function mountDesktop(): void {
        document.body.replaceChildren();
        const canvas = document.createElement('div');
        canvas.id = 'desktop-canvas';
        document.body.appendChild(canvas);
    }

    beforeEach(() => {
        mountDesktop();
        installMemoryStorage();
    });

    it('falls back to about:blank for an active-content manifest src', () => {
        const engine = new Prestige({
            animations: false,
            apps: {
                hostile: { id: 'hostile', title: 'Hostile', tier: 'isolated', src: 'data:text/html,<script>steal()</script>' },
            },
        });
        const win = engine.openWindow('hostile');
        const iframe = win?.querySelector<HTMLIFrameElement>('iframe.prestige-app-sandbox');
        expect(iframe).not.toBeNull();
        expect(iframe?.getAttribute('src')).toBe('about:blank');
        engine.destroy();
    });

    it('falls back to about:blank for a javascript: manifest src', () => {
        const engine = new Prestige({
            animations: false,
            apps: { hostile: { id: 'hostile', title: 'Hostile', tier: 'isolated', src: 'javascript:top.location="https://evil.example"' } },
        });
        const win = engine.openWindow('hostile');
        const iframe = win?.querySelector<HTMLIFrameElement>('iframe.prestige-app-sandbox');
        expect(iframe?.getAttribute('src')).toBe('about:blank');
        engine.destroy();
    });

    it('keeps a valid relative manifest src', () => {
        const engine = new Prestige({
            animations: false,
            apps: { app: { id: 'app', title: 'App', tier: 'isolated', src: '/apps/app.html' } },
        });
        const wm = (engine as unknown as { _wm: { createWindow(id: string): HTMLElement } })._wm;
        const win = wm.createWindow('app');
        const iframe = win?.querySelector<HTMLIFrameElement>('iframe.prestige-app-sandbox');
        expect(iframe?.getAttribute('src')).toBe('/apps/app.html');
        (win as HTMLElement & { _disposal?: { dispose(): void } })._disposal?.dispose();
        engine.destroy();
    });
});

describe('web3TransactionGuard stylesheet tamper detection', () => {
    const tx = {
        action: 'approve',
        to: '0x0123456789abcdef0123456789abcdef01234567' as const,
        value: 1_000_000_000_000_000_000n,
        chainId: 1,
    };

    it('aborts the transaction when a <style> is injected into document.head', async () => {
        const host = new TestHost();
        const promise = web3TransactionGuard(host, tx);
        const style = document.createElement('style');
        style.textContent = '.prestige-web3-guard-confirm{position:fixed;opacity:0.01}';
        document.head.appendChild(style);
        await expect(promise).resolves.toBe(false);
        expect(document.querySelector('.prestige-web3-guard')).toBeNull();
        style.remove();
    });

    it('aborts the transaction when a <link> is injected into document.head', async () => {
        const host = new TestHost();
        const promise = web3TransactionGuard(host, tx);
        const link = document.createElement('link');
        link.href = 'about:blank';
        document.head.appendChild(link);
        await expect(promise).resolves.toBe(false);
        link.remove();
    });
});
