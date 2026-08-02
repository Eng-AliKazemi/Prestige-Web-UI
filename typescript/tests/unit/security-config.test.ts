/**
 * Security customization hook verification: constructor validation & loud
 * opt-outs, the pluggable sanitizer (`sanitizeWith` / `replaceContent`), the
 * `clickjackCheck` toggle, and the `postTargetOrigin` resolver hook.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prestige } from '../../src/core/DesktopEngine.js';
import { replaceContent } from '../../src/utils/dom.js';
import { sanitizeHtml, sanitizeWith } from '../../src/utils/sanitize.js';
import { web3TransactionGuard } from '../../src/ui/Dialogs.js';
import { createTabs, createDataTable, createAlert, createAccordion } from '../../src/ui/Components.js';
import type { SecurityOptions } from '../../src/types/desktop.js';
import { installMemoryStorage } from '../helpers/memoryStorage.js';
import { TestHost } from '../helpers/testHost.js';

class ConfigurableHost extends TestHost {
    public config?: { security?: SecurityOptions } | undefined;
    public constructor(config?: { security?: SecurityOptions }) {
        super();
        this.config = config;
    }
}

function mountDesktop(): void {
    document.body.replaceChildren();
    const canvas = document.createElement('div');
    canvas.id = 'desktop-canvas';
    document.body.appendChild(canvas);
}

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe('security config validation', () => {
    it('throws when storage is encrypted without a key provider', () => {
        expect(() => new Prestige({ security: { storage: 'encrypted' } }))
            .toThrow(/storageKeyProvider/);
    });

    it('warns loudly when clickjackCheck is disabled', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        new Prestige({ animations: false, security: { clickjackCheck: false } });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('clickjackCheck'));
    });

    it('warns when a key provider is supplied without encrypted storage', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        new Prestige({ animations: false, security: { storageKeyProvider: async () => null } });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('storageKeyProvider'));
    });

    it('warns on unknown security options', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        new Prestige({ animations: false, security: { bogus: true } as unknown as SecurityOptions });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('bogus'));
    });
});

describe('pluggable sanitizer', () => {
    it('defaults to the built-in TreeWalker sanitizer when none is configured', () => {
        const frag = sanitizeWith('<p>hi</p><script>alert(1)</script>');
        expect(frag.querySelector('script')).toBeNull();
        expect(frag.textContent).toContain('hi');
    });

    it('invokes a custom fragment-returning sanitizer', () => {
        const custom = vi.fn((_dirty: string): DocumentFragment => {
            const t = document.createElement('template');
            t.innerHTML = '<b>trusted</b>';
            return t.content;
        });
        const frag = sanitizeWith('<script>x</script>', custom);
        expect(custom).toHaveBeenCalledWith('<script>x</script>');
        expect(frag.querySelector('b')?.textContent).toBe('trusted');
    });

    it('parses a string-returning sanitizer result into a fragment', () => {
        const custom = vi.fn((_dirty: string): string => '<i>ok</i>');
        const frag = sanitizeWith('x', custom);
        expect(frag.querySelector('i')?.textContent).toBe('ok');
    });

    it('replaceContent honors a supplied sanitizer on the trusted path', () => {
        const custom = vi.fn((dirty: string): DocumentFragment => {
            const t = document.createElement('template');
            t.innerHTML = `<b>${dirty}</b>`;
            return t.content;
        });
        const el = document.createElement('div');
        document.body.appendChild(el);
        replaceContent(el, '<em>raw</em>', true, custom);
        expect(custom).toHaveBeenCalledWith('<em>raw</em>');
        expect(el.querySelector('b em')?.textContent).toBe('raw');

        replaceContent(el, '<script>alert(1)</script>', true, null);
        expect(el.querySelector('script')).toBeNull();
    });

    it('keeps the exported sanitizeHtml default intact', () => {
        const frag = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
        expect(frag.querySelector('a')?.getAttribute('href')).toBeNull();
    });

    it('threads the configured sanitizer through html-capable primitives', () => {
        const custom = vi.fn((_dirty: string): DocumentFragment => {
            const t = document.createElement('template');
            t.innerHTML = '<b>custom</b>';
            return t.content;
        });
        const host = new ConfigurableHost({ security: { sanitizer: custom } });

        const tabs = createTabs([{ label: 'A', content: '<em>x</em>', trustedHtml: true }], { instance: host });
        document.body.appendChild(tabs);
        expect(custom).toHaveBeenCalledWith('<em>x</em>');
        expect(tabs.querySelector('.prestige-tabs-panel b')?.textContent).toBe('custom');

        const table = createDataTable({
            columns: [{ key: 'c', label: 'C', html: true }],
            rows: [{ c: '<i>y</i>' }],
            instance: host,
        });
        document.body.appendChild(table);
        expect(custom).toHaveBeenCalledWith('<i>y</i>');
        expect(table.querySelector('tbody b')?.textContent).toBe('custom');

        const alert = createAlert({ message: '<u>z</u>', html: true, instance: host });
        document.body.appendChild(alert);
        expect(custom).toHaveBeenCalledWith('<u>z</u>');

        const accordion = createAccordion({ items: [{ title: 'T', content: '<s>w</s>', html: true }], instance: host });
        document.body.appendChild(accordion);
        expect(custom).toHaveBeenCalledWith('<s>w</s>');
    });
});

describe('web3TransactionGuard clickjack toggle', () => {
    const tx = {
        action: 'approve',
        to: '0x0123456789abcdef0123456789abcdef01234567' as const,
        value: 1_000_000_000_000_000_000n,
        data: '0xdeadbeef' as const,
        chainId: 1,
    };

    it('enforces the visual safety check by default', async () => {
        const host = new ConfigurableHost();
        const promise = web3TransactionGuard(host, tx);
        const confirmBtn = document.querySelector<HTMLButtonElement>('.prestige-web3-guard-confirm');
        expect(confirmBtn).not.toBeNull();
        if (!confirmBtn) return;
        confirmBtn.click();
        await expect(promise).resolves.toBe(false);
    });

    it('skips the visual check when security.clickjackCheck is false', async () => {
        const host = new ConfigurableHost({ security: { clickjackCheck: false } });
        const original = document.elementFromPoint;
        Object.defineProperty(document, 'elementFromPoint', {
            configurable: true,
            value: () => { throw new Error('elementFromPoint must not be called when clickjackCheck is disabled'); },
        });
        try {
            const promise = web3TransactionGuard(host, tx);
            const confirmBtn = document.querySelector<HTMLButtonElement>('.prestige-web3-guard-confirm');
            confirmBtn?.click();
            await expect(promise).resolves.toBe(true);
        } finally {
            Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: original });
        }
    });
});

describe('postTargetOrigin resolver hook', () => {
    beforeEach(() => {
        mountDesktop();
        installMemoryStorage();
    });

    it('consults the configured resolver for isolated-tier windows', () => {
        const resolver = vi.fn(() => 'https://pinned.example');
        const engine = new Prestige({
            animations: false,
            security: { postTargetOrigin: resolver },
            apps: { sandboxed: { id: 'sandboxed', title: 'Sandboxed', tier: 'isolated', src: 'about:blank' } },
        });
        const win = engine.openWindow('sandboxed');
        const iframe = win?.querySelector<HTMLIFrameElement>('iframe.prestige-app-sandbox');
        expect(iframe).not.toBeNull();
        if (!iframe) return;

        const cw = iframe.contentWindow;
        if (cw && typeof cw.postMessage === 'function') {
            const postSpy = vi.spyOn(cw, 'postMessage').mockImplementation(() => {});
            iframe.dispatchEvent(new Event('load'));
            expect(resolver).toHaveBeenCalledWith(iframe.sandbox.value, 'about:blank', expect.any(String));
            expect(postSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'PRESTIGE_INIT' }),
                'https://pinned.example',
                expect.any(Array),
            );
        } else {
            iframe.dispatchEvent(new Event('load'));
            expect(resolver).toHaveBeenCalledWith(iframe.sandbox.value, 'about:blank', expect.any(String));
        }
        engine.destroy();
    });
});
