/**
 * Test helpers: happy-dom has no layout engine, so geometry-dependent code
 * (window snapping, clickjacking checks) needs mocked rects / hit-testing.
 */

/** Override getBoundingClientRect on an element with a (partial) rect. */
export function mockRect(element: HTMLElement, rect: Partial<DOMRect>): void {
    Object.defineProperty(element, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
            top: 0,
            left: 0,
            right: 800,
            bottom: 600,
            width: 800,
            height: 600,
            x: 0,
            y: 0,
            ...rect,
        }),
    });
}

/** Make elementFromPoint always return the given element. */
export function mockElementFromPoint(element: Element): void {
    Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: () => element,
    });
}
