/**
 * PRESTIGE_INIT postMessage targetOrigin resolution for isolated-tier iframes.
 *
 * A sandboxed iframe without `allow-same-origin` runs in an opaque origin, so a
 * concrete targetOrigin is silently dropped by the browser — `'*'` is required.
 * Only when `allow-same-origin` is granted can the target be pinned.
 */
import { describe, expect, it } from 'vitest';
import { isolatedPostTargetOrigin } from '../../src/utils/dom.js';

const BASE = 'http://host/app/index.html';

describe('isolatedPostTargetOrigin', () => {
    it('returns "*" for the default opaque-origin sandbox (no allow-same-origin)', () => {
        expect(isolatedPostTargetOrigin('allow-scripts allow-forms', 'http://host/app/sandbox.html', BASE)).toBe('*');
        expect(isolatedPostTargetOrigin('', 'http://host/app/sandbox.html', BASE)).toBe('*');
        expect(isolatedPostTargetOrigin('allow-scripts', undefined, BASE)).toBe('*');
    });

    it('pins to the frame origin when allow-same-origin is granted and src is http(s)', () => {
        expect(isolatedPostTargetOrigin('allow-scripts allow-forms allow-same-origin', 'http://host/app/sandbox.html', BASE)).toBe('http://host');
        expect(isolatedPostTargetOrigin('allow-same-origin', 'https://cdn.example.org/app.js', BASE)).toBe('https://cdn.example.org');
        expect(isolatedPostTargetOrigin('allow-same-origin', '/sandbox.html', BASE)).toBe('http://host');
        expect(isolatedPostTargetOrigin('allow-same-origin', undefined, BASE)).toBe('http://host');
    });

    it('falls back to the host origin for non-http(s) or malformed src', () => {
        expect(isolatedPostTargetOrigin('allow-same-origin', 'about:blank', BASE)).toBe('http://host');
        expect(isolatedPostTargetOrigin('allow-same-origin', 'file:///tmp/x.html', BASE)).toBe('http://host');
    });
});
