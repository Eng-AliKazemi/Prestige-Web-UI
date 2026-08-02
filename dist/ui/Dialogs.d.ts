import type { Web3TransactionDetails } from '../types/web3.js';
import type { SecurityHost } from '../types/desktop.js';
/** Minimal host surface required to mount dialogs and register key handlers. */
export interface DialogHost extends SecurityHost {
    _mountNode(node: Node): Node;
    _unmountNode?(node: Node | null): void;
    _listen(target: EventTarget, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}
export type DialogType = 'info' | 'warning' | 'danger' | 'alert' | 'confirm' | 'prompt' | 'save' | 'open';
export interface DialogOptions {
    type?: DialogType;
    title?: string;
    message?: string;
    icon?: string;
    confirmText?: string;
    cancelText?: string;
    defaultValue?: string;
    placeholder?: string;
    noOverlay?: boolean;
    danger?: boolean;
    width?: number;
    multiple?: boolean;
    accept?: string;
}
export type SaveDialogResult = {
    filename: string | null;
    confirmed: boolean;
};
export type DialogResult = true | false | string | null | SaveDialogResult | FileList;
/** Shared dialog engine. Resolves with the type-specific result on dismissal. */
export declare function dialogShow(host: DialogHost, opts?: DialogOptions): Promise<DialogResult>;
/** Info dialog. Resolves `true` on dismissal. */
export declare function dialogInfo(host: DialogHost, o?: string | DialogOptions): Promise<true>;
/** Warning dialog. Resolves `true` on dismissal. */
export declare function dialogWarning(host: DialogHost, o?: string | DialogOptions): Promise<true>;
/** Danger dialog. Resolves `true` on dismissal. */
export declare function dialogDanger(host: DialogHost, o?: string | DialogOptions): Promise<true>;
/** Alert dialog. Resolves `true` on dismissal. */
export declare function dialogAlert(host: DialogHost, o?: string | DialogOptions): Promise<true>;
/** Confirmation dialog. Resolves `true` on confirm, `false` on cancel/escape. */
export declare function dialogConfirm(host: DialogHost, o?: string | DialogOptions): Promise<boolean>;
/** Prompt dialog. Resolves the entered value or `null` on cancel. */
export declare function dialogPrompt(host: DialogHost, o?: string | DialogOptions): Promise<string | null>;
/** Save dialog. Resolves `{ filename, confirmed }`. */
export declare function dialogSave(host: DialogHost, o?: string | DialogOptions): Promise<SaveDialogResult>;
/** Open-file dialog. Resolves the selected FileList or `null`. */
export declare function dialogOpen(host: DialogHost, o?: string | DialogOptions): Promise<FileList | null>;
/**
 * Clickjacking verification: an element is visually safe only when it is
 * visible, has non-zero size, and is the topmost element at every sampled
 * point (center + four inset corners). A single center sample can be passed
 * by an overlay with a small cutout over the button's center pixel; sampling
 * the boundaries too defeats corner/edge obscuring. Elements with
 * `pointer-events: none` are invisible to hit testing, so the sampled points
 * are additionally checked against such inert overlays (see
 * `isObscuredByInertOverlay`).
 */
export declare function isElementVisuallySafe(element: HTMLElement): boolean;
/**
 * High-security transaction confirmation overlay.
 *
 * - Mounts at the `--prestige-plane-security` plane (z-index 999999); the
 *   plane is enforced in CSS (`position: fixed` + z-index) so the overlay is
 *   genuinely topmost.
 * - Rejects the transaction if injected code mutates the modal DOM or
 *   injects stylesheets into `<head>` (`MutationObserver`), protecting
 *   against extension tampering and CSS-based clickjacking.
 * - Only confirms when the confirm button passes `isElementVisuallySafe()`
 *   (clickjacking defense).
 */
export declare function web3TransactionGuard(host: DialogHost, txDetails: Web3TransactionDetails): Promise<boolean>;
//# sourceMappingURL=Dialogs.d.ts.map