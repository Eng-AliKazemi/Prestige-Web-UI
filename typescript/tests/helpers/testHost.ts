/**
 * Test helper: a minimal DialogHost / ComponentHost that appends nodes to
 * document.body and binds listeners directly (so explicit removeEventListener
 * teardown works).
 */
import type { ComponentHost } from '../../src/ui/ComponentRegistry.js';
import type { DialogHost } from '../../src/ui/Dialogs.js';

export class TestHost implements ComponentHost, DialogHost {
    public _mountNode(node: Node): Node {
        document.body.appendChild(node);
        return node;
    }

    public _listen(
        target: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ): void {
        target.addEventListener(type, listener, options);
    }

    public _query(selector: string): Element | null {
        return document.querySelector(selector);
    }
}
