/**
 * Phase 2 verification: structural DOM construction, DisposalStack / Owned
 * resource management (TC39 Symbol.dispose), and sanitizer contracts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DisposalStack, Owned } from '../../src/core/Memory.js';
import { $id, $tag, $text, replaceContent, type TagAttributes } from '../../src/utils/dom.js';
import { assertSafeAppId, sanitizeHtml } from '../../src/utils/sanitize.js';

afterEach(() => {
    document.body.replaceChildren();
});

describe('$tag structural DOM construction', () => {
    it('builds elements via node methods without parsing any HTML string', () => {
        const clickSpy = vi.fn((_e: Event) => {});
        const btn = $tag('button', { class: 'btn', 'data-x': '1', onclick: clickSpy }, ['Click']);
        document.body.appendChild(btn);
        btn.click();
        expect(btn.tagName).toBe('BUTTON');
        expect(btn.className).toBe('btn');
        expect(btn.getAttribute('data-x')).toBe('1');
        expect(btn.textContent).toBe('Click');
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('handles style objects, boolean attributes, and numeric attributes', () => {
        const el = $tag('div', { style: { position: 'absolute', inset: '0' }, hidden: true, tabindex: 0 });
        expect(el.style.position).toBe('absolute');
        expect(el.style.inset).toBe('0');
        expect(el.hasAttribute('hidden')).toBe(true);
        expect(el.getAttribute('tabindex')).toBe('0');
    });

    it('renders string children as text, never as markup', () => {
        const el = $tag('div', {}, ['<img src=x onerror=alert(1)>']);
        expect(el.querySelector('img')).toBeNull();
        expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
    });

    it('skips undefined and false attributes', () => {
        const el = $tag('div', { 'data-a': undefined, 'data-b': false, 'data-c': 'keep' });
        expect(el.hasAttribute('data-a')).toBe(false);
        expect(el.hasAttribute('data-b')).toBe(false);
        expect(el.getAttribute('data-c')).toBe('keep');
    });

    it('rejects string event handlers and srcdoc while retaining function listeners', () => {
        const clickSpy = vi.fn();
        const attrs = {
            onclick: 'document.body.dataset.pwned = "true"',
            ONLOAD: 'document.body.dataset.loaded = "true"',
            srcdoc: '<script>document.body.dataset.framed = "true"</script>',
        } as unknown as TagAttributes;
        const iframe = $tag('iframe', attrs);
        const button = $tag('button', { onclick: clickSpy });

        button.click();
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(iframe.hasAttribute('onclick')).toBe(false);
        expect(iframe.hasAttribute('onload')).toBe(false);
        expect(iframe.hasAttribute('srcdoc')).toBe(false);
    });

    it('sets safe URL attributes and rejects unsafe schemes', () => {
        const anchor = $tag('a', { href: '/account' });
        const relativeImage = $tag('img', { src: 'images/avatar.png' });
        const queryLink = $tag('a', { href: '?page=2' });
        const iframe = $tag('iframe', { src: 'about:blank' });
        const unsafeAnchor = $tag('a', { href: 'javascript:alert(1)' });
        const obfuscatedAnchor = $tag('a', { href: 'java\nscript:alert(1)' });
        const unsafeImage = $tag('img', { src: 'data:text/html,<script>alert(1)</script>' });
        const unsafeForm = $tag('form', { action: 'vbscript:msgbox(1)' });

        expect(anchor.getAttribute('href')).toBe('/account');
        expect(relativeImage.getAttribute('src')).toBe('images/avatar.png');
        expect(queryLink.getAttribute('href')).toBe('?page=2');
        expect(iframe.getAttribute('src')).toBe('about:blank');
        expect(unsafeAnchor.hasAttribute('href')).toBe(false);
        expect(obfuscatedAnchor.hasAttribute('href')).toBe(false);
        expect(unsafeImage.hasAttribute('src')).toBe(false);
        expect(unsafeForm.hasAttribute('action')).toBe(false);
    });

    it('$text creates a raw text node and $id resolves elements', () => {
        const host = $tag('div', { id: 'probe' });
        host.appendChild($text('<b>literal</b>'));
        document.body.appendChild(host);
        expect($id('probe')).toBe(host);
        expect(host.childNodes[0]).toBeInstanceOf(Text);
        expect(host.textContent).toBe('<b>literal</b>');
    });
});

describe('replaceContent', () => {
    it('clears children and inserts strings as plain text', () => {
        const parent = $tag('div', {}, []);
        parent.appendChild($tag('span'));
        replaceContent(parent, 'hello <b>world</b>');
        expect(parent.querySelector('b')).toBeNull();
        expect(parent.textContent).toBe('hello <b>world</b>');
    });

    it('appends DOM nodes directly and clears on null', () => {
        const parent = $tag('div', {}, []);
        const em = $tag('em');
        replaceContent(parent, em);
        expect(parent.querySelector('em')).toBe(em);
        replaceContent(parent, null);
        expect(parent.childElementCount).toBe(0);
    });

    it('routes trustedHtml through the sanitizer', () => {
        const parent = $tag('div', {}, []);
        replaceContent(parent, '<p onclick="x()">safe</p><script>evil()</script>', true);
        expect(parent.querySelector('script')).toBeNull();
        const p = parent.querySelector('p');
        expect(p).not.toBeNull();
        expect(p?.hasAttribute('onclick')).toBe(false);
        expect(parent.textContent).toBe('safe');
    });
});

describe('DisposalStack', () => {
    it('executes deferred cleanups in LIFO order on Symbol.dispose() and is idempotent', () => {
        const order: string[] = [];
        const stack = new DisposalStack('test');
        stack.defer(() => order.push('a'));
        stack.defer(() => order.push('b'));
        stack[Symbol.dispose]();
        expect(order).toEqual(['b', 'a']);
        stack[Symbol.dispose]();
        expect(order).toEqual(['b', 'a']);
    });

    it('removes event listeners it registered', () => {
        const stack = new DisposalStack();
        const el = document.createElement('button');
        const spy = vi.fn((_e: Event) => {});
        stack.listen(el, 'click', spy);
        el.click();
        expect(spy).toHaveBeenCalledTimes(1);
        stack[Symbol.dispose]();
        el.click();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('clears timers on disposal', async () => {
        const stack = new DisposalStack();
        const spy = vi.fn();
        stack.setTimeout(spy, 5);
        stack[Symbol.dispose]();
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(spy).not.toHaveBeenCalled();
    });

    it('disposes owned Disposables and audits live Owned handles as leaks', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const stack = new DisposalStack('leak-check');
            const disposer = vi.fn();
            const owned = new Owned('value', disposer);
            stack.own(owned);
            expect(owned.isAlive()).toBe(true);
            stack[Symbol.dispose]();
            expect(disposer).toHaveBeenCalledTimes(1);
            expect(owned.isAlive()).toBe(false);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('1 Owned resource'));
        } finally {
            warnSpy.mockRestore();
        }
    });
});

describe('DisposalStack.ownSecret', () => {
    it('zero-fills an ArrayBuffer via a Uint8Array view on disposal', () => {
        const stack = new DisposalStack();
        const bytes = new Uint8Array([1, 2, 3, 4, 5]);
        const buffer = bytes.buffer;
        stack.ownSecret(buffer);
        expect(new Uint8Array(buffer).some((b) => b !== 0)).toBe(true);
        stack[Symbol.dispose]();
        expect(new Uint8Array(buffer).every((b) => b === 0)).toBe(true);
    });

    it('zero-fills a Uint8Array directly on disposal', () => {
        const stack = new DisposalStack();
        const secret = new Uint8Array([9, 9, 9, 9]);
        stack.ownSecret(secret);
        expect(secret[0]).toBe(9);
        stack[Symbol.dispose]();
        expect(secret.every((b) => b === 0)).toBe(true);
    });
});

describe('Owned', () => {
    it('throws on .use() after .move() and on a double .move()', () => {
        const owned = new Owned({ port: 42 }, () => {});
        const moved = owned.move();
        expect(() => owned.use((r) => r.port)).toThrow(/use-after-move/);
        const moved2 = moved.move();
        expect(() => moved.move()).toThrow(/double-move/);
        expect(moved2.use((r) => r.port)).toBe(42);
        moved2.dispose();
    });

    it('invokes the disposer exactly once and only while alive', () => {
        const disposer = vi.fn();
        const owned = new Owned('value', disposer);
        expect(owned.isAlive()).toBe(true);
        owned.dispose();
        owned.dispose();
        expect(disposer).toHaveBeenCalledTimes(1);
        expect(owned.isAlive()).toBe(false);
    });
});

describe('sanitizeHtml', () => {
    it('strips dangerous elements and inline handlers', () => {
        const frag = sanitizeHtml(
            '<p onclick="x()">hi</p><script>evil()</script><iframe src="https://evil.example"></iframe>',
        );
        expect(frag.querySelector('script')).toBeNull();
        expect(frag.querySelector('iframe')).toBeNull();
        const p = frag.querySelector('p');
        expect(p).not.toBeNull();
        expect(p?.hasAttribute('onclick')).toBe(false);
        expect(frag.textContent).toBe('hi');
    });

    it('keeps safe images but strips javascript: URLs', () => {
        const frag = sanitizeHtml(
            '<img src="https://ok.test/a.png" alt="ok"><img src="javascript:alert(1)">',
        );
        const imgs = frag.querySelectorAll('img');
        expect(imgs.length).toBe(2);
        expect(imgs[1].getAttribute('src')).toBeNull();
        expect(imgs[0].getAttribute('src')).toBe('https://ok.test/a.png');
    });

    it('does not process descendants of a removed blocked element', () => {
        const frag = sanitizeHtml('<script><img src="javascript:alert(1)" onerror="evil()"></script><p>safe</p>');
        expect(frag.querySelector('script')).toBeNull();
        expect(frag.querySelector('img')).toBeNull();
        expect(frag.textContent).toBe('safe');
    });

    it('blocks SVG XSS/network vectors: foreignObject, use, image, feImage, and animation tags', () => {
        const frag = sanitizeHtml(
            '<svg><foreignObject><div>f</div></foreignObject>' +
            '<use href="https://evil.test/x.svg"></use>' +
            '<image href="https://evil.test/i.svg"></image>' +
            '<feImage href="https://evil.test/f.svg"></feImage>' +
            '<animateMotion dur="1s"></animateMotion>' +
            '<animateTransform dur="1s"></animateTransform>' +
            '<discard></discard>' +
            '<rect></rect></svg>',
        );
        const tags = Array.from(frag.querySelectorAll('*')).map((el) => el.tagName.toLowerCase());
        expect(tags).not.toContain('foreignobject');
        expect(tags).not.toContain('use');
        expect(tags).not.toContain('image');
        expect(tags).not.toContain('feimage');
        expect(tags).not.toContain('animatemotion');
        expect(tags).not.toContain('animatetransform');
        expect(tags).not.toContain('discard');
        expect(tags).toContain('rect');
    });

    it('strips scripts even inside a foreignObject HTML integration point', () => {
        const frag = sanitizeHtml('<svg><foreignObject><script>alert(1)</script></foreignObject></svg>');
        expect(frag.querySelector('script')).toBeNull();
        expect(frag.textContent).toBe('');
    });
});

describe('assertSafeAppId', () => {
    it('accepts valid app ids and rejects invalid ones', () => {
        expect(assertSafeAppId('Dashboard_1')).toBe('Dashboard_1');
        expect(() => assertSafeAppId('1bad')).toThrow();
        expect(() => assertSafeAppId('a b')).toThrow();
        expect(() => assertSafeAppId('')).toThrow();
    });
});
