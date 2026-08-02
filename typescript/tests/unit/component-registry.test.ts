/** Component registry security and runtime-contract regression tests. */
import { describe, expect, it } from 'vitest';
import {
    applyComponentOptions,
    ComponentRegistry,
    type ComponentFactory,
} from '../../src/ui/ComponentRegistry.js';

describe('applyComponentOptions attribute safety', () => {
    it('rejects executable and unsafe URL attributes while applying safe attributes', () => {
        const anchor = document.createElement('a');
        applyComponentOptions(anchor, {
            attributes: {
                onclick: 'document.body.dataset.pwned = "true"',
                srcdoc: '<script>alert(1)</script>',
                href: 'javascript:alert(1)',
                title: 'Profile',
            },
        });

        expect(anchor.hasAttribute('onclick')).toBe(false);
        expect(anchor.hasAttribute('srcdoc')).toBe(false);
        expect(anchor.hasAttribute('href')).toBe(false);
        expect(anchor.getAttribute('title')).toBe('Profile');

        applyComponentOptions(anchor, { attributes: { href: 'profiles/ada' } });
        expect(anchor.getAttribute('href')).toBe('profiles/ada');
    });

    it('does not override security attributes established by a factory', () => {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('sandbox', 'allow-scripts');
        iframe.setAttribute('referrerpolicy', 'no-referrer');

        applyComponentOptions(iframe, {
            attributes: {
                sandbox: 'allow-scripts allow-same-origin',
                referrerpolicy: 'unsafe-url',
            },
        });

        expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
        expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
    });
});

describe('ComponentRegistry factory contract', () => {
    it('accepts HTMLElement results', () => {
        const registry = new ComponentRegistry();
        registry.register('panel', () => document.createElement('section'));
        expect(registry.create('panel')).toBeInstanceOf(HTMLElement);
    });

    it('rejects DOM Nodes that are not HTMLElements', () => {
        const registry = new ComponentRegistry();
        const textFactory = (() => document.createTextNode('not an element')) as unknown as ComponentFactory;
        registry.register('text', textFactory);
        expect(() => registry.create('text')).toThrow('must return an HTMLElement');
    });
});
