/**
 * LucideIcons module verification: typed registry, SVG rendering, and
 * placeholder replacement (all structural — no innerHTML in the library path).
 */
import { describe, expect, it } from 'vitest';
import { createIcon, dialogIcon, DIALOG_ICON_NAMES, ICONS, renderIcons, type IconName } from '../../src/ui/LucideIcons.js';
import { $tag } from '../../src/utils/dom.js';

describe('LucideIcons', () => {
    it('derives IconName from the registry keys', () => {
        const name: IconName = 'info';
        expect(typeof name).toBe('string');
        expect(ICONS).toHaveProperty('info');
        expect(ICONS).toHaveProperty('circle');
        expect(ICONS).toHaveProperty('shield');
        expect(ICONS).toHaveProperty('cpu');
        expect(ICONS).toHaveProperty('gauge');
        expect(ICONS).toHaveProperty('clock');
    });

    it('creates an SVG element without parsing user strings', () => {
        const svg = createIcon('info', { class: 'icon-sm', title: 'Details' });
        expect(svg.tagName).toBe('svg');
        expect(svg.getAttribute('class')).toBe('icon-sm');
        expect(svg.getAttribute('aria-label')).toBe('Details');
        expect(svg.getAttribute('aria-hidden')).toBeNull();
        expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });

    it('applies aria-hidden, role, and style attributes', () => {
        const svg = createIcon('check', {
            class: '',
            title: '',
            'aria-hidden': 'true',
            role: 'img',
            style: 'color: red',
        });
        expect(svg.getAttribute('aria-hidden')).toBe('true');
        expect(svg.getAttribute('role')).toBe('img');
        expect(svg.getAttribute('style')).toBe('color: red');
    });

    it('renders data-prestige-icon placeholders into SVG nodes', () => {
        const host = $tag('div', {}, [
            $tag('i', { 'data-prestige-icon': 'settings', class: 'ic' }),
        ]);
        renderIcons(host);
        const svg = host.querySelector('svg[data-prestige-icon="settings"]');
        expect(svg).not.toBeNull();
        expect(svg?.getAttribute('class')).toBe('ic');
        expect(svg?.getAttribute('data-prestige-rendered')).toBe('true');
    });

    it('does not re-render an already-rendered placeholder', () => {
        const host = $tag('div', {}, [
            $tag('i', { 'data-prestige-icon': 'bell', 'data-prestige-rendered': 'true' }),
        ]);
        renderIcons(host);
        expect(host.querySelector('svg')).toBeNull();
        expect(host.querySelector('i')).not.toBeNull();
    });

    it('resolves unknown names to the circle fallback instead of throwing', () => {
        const svg = createIcon('not-a-real-icon' as IconName);
        expect(svg.tagName).toBe('svg');
        expect(svg.getAttribute('data-prestige-icon')).toBeNull();
        expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });

    it('does not resolve inherited object properties as icon or dialog alias names', () => {
        expect(createIcon('toString' as IconName).querySelector('circle')).not.toBeNull();
        expect(dialogIcon('constructor').querySelector('circle')).not.toBeNull();
    });

    it('maps dialog icon aliases to registry names', () => {
        expect(DIALOG_ICON_NAMES.info).toBe('info');
        expect(DIALOG_ICON_NAMES.warning).toBe('triangle-alert');
        expect(DIALOG_ICON_NAMES.danger).toBe('circle-alert');
    });
});
