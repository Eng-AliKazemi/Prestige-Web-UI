/* ═══════════════════════════════════════════════════════════════════════════
   Prestige UI — Promise-based Dialogs & Security Overlays
   TypeScript port of src/dialogs.js plus the Web3 transaction security guard.
   ═══════════════════════════════════════════════════════════════════════════ */
import { $tag, $text, trapFocusWithin } from '../utils/dom.js';
import type { Web3TransactionDetails } from '../types/web3.js';
import type { SecurityHost } from '../types/desktop.js';
import { createBtn } from './Components.js';
import { dialogIcon } from './LucideIcons.js';

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

export type SaveDialogResult = { filename: string | null; confirmed: boolean };
export type DialogResult = true | false | string | null | SaveDialogResult | FileList;

const DIALOG_DEFAULT_ICONS: Record<string, string> = {
    info: 'info',
    warning: 'warning',
    danger: 'danger',
    alert: 'info',
    confirm: 'question',
    prompt: 'question',
    save: 'save',
    open: 'open',
};

const CANCEL_TYPES = new Set<DialogType>(['confirm', 'prompt', 'save', 'open']);

/** Tracks active dialogs so only the topmost instance handles global keys. */
const modalStack: HTMLElement[] = [];

function isTopmostModal(modal: HTMLElement): boolean {
    while (modalStack.length && !modalStack[modalStack.length - 1]?.isConnected) modalStack.pop();
    return modalStack[modalStack.length - 1] === modal;
}

function removeModal(modal: HTMLElement): void {
    const index = modalStack.lastIndexOf(modal);
    if (index !== -1) modalStack.splice(index, 1);
}

function cancelResult(type: DialogType): DialogResult {
    if (type === 'confirm') return false;
    if (type === 'prompt' || type === 'open') return null;
    if (type === 'save') return { filename: null, confirmed: false };
    return true;
}

function unmount(host: DialogHost, node: Node | null): void {
    if (host._unmountNode) host._unmountNode(node);
    else node?.parentNode?.removeChild(node);
}

function normalizeStringOrOptions(value: string | DialogOptions): DialogOptions {
    return typeof value === 'string' ? { message: value } : value;
}

/** Shared dialog engine. Resolves with the type-specific result on dismissal. */
export function dialogShow(host: DialogHost, opts: DialogOptions = {}): Promise<DialogResult> {
    const options: Required<Pick<DialogOptions, 'confirmText' | 'cancelText' | 'defaultValue' | 'placeholder' | 'noOverlay' | 'danger' | 'width' | 'multiple' | 'accept'>> & DialogOptions = {
        confirmText: 'OK',
        cancelText: 'Cancel',
        defaultValue: '',
        placeholder: '',
        noOverlay: false,
        danger: false,
        width: 420,
        multiple: false,
        accept: '',
        ...opts,
    };
    const type: DialogType = options.type ?? 'info';
    const icon = options.icon ?? DIALOG_DEFAULT_ICONS[type] ?? 'info';
    const hasCancel = CANCEL_TYPES.has(type);

    return new Promise<DialogResult>((resolve) => {
        const previousFocus = document.activeElement;
        let overlay: HTMLDivElement | null = null;
        if (!options.noOverlay) {
            overlay = $tag('div', { class: 'modal-overlay' });
            const bg = $tag('div', {
                style: {
                    position: 'absolute',
                    inset: '0',
                    background: 'var(--prestige-glass-65)',
                    backdropFilter: 'blur(12px)',
                },
            });
            Object.assign(bg.style, { WebkitBackdropFilter: 'blur(12px)' });
            overlay.appendChild(bg);
            host._mountNode(overlay);
            requestAnimationFrame(() => overlay?.classList.add('active'));
        }

        const dlg = $tag('div', { class: 'prestige-dialog', 'data-type': type, role: 'dialog', 'aria-modal': 'true', 'aria-label': options.title ?? 'Dialog', tabindex: '-1' });
        dlg.style.width = `${Math.min(options.width, window.innerWidth - 40)}px`;
        dlg.style.maxHeight = `${window.innerHeight - 80}px`;

        const header = $tag('div', { class: 'prestige-dialog-header' });
        const iconEl = $tag('div', { class: 'prestige-dialog-icon' });
        const svg = dialogIcon(icon);
        iconEl.appendChild(svg.cloneNode(true));
        header.appendChild(iconEl);
        header.appendChild($tag('h3', { class: 'prestige-dialog-title' }, [$text(options.title ?? '')]));
        dlg.appendChild(header);

        const body = $tag('div', { class: 'prestige-dialog-body' });
        body.appendChild($tag('p', { class: 'prestige-dialog-message' }, [$text(options.message ?? '')]));

        let inputEl: HTMLInputElement | null = null;
        if (type === 'prompt') {
            inputEl = $tag('input', {
                class: 'prestige-dialog-input',
                type: 'text',
                placeholder: options.placeholder,
                'aria-label': options.title?.trim() || 'Input',
            });
            inputEl.value = options.defaultValue;
            body.appendChild(inputEl);
        } else if (type === 'save') {
            inputEl = $tag('input', { class: 'prestige-dialog-input', type: 'text', placeholder: 'filename.ext', 'aria-label': 'Filename' });
            inputEl.value = options.defaultValue || 'untitled.txt';
            body.appendChild(inputEl);
        } else if (type === 'open') {
            inputEl = $tag('input', { class: 'prestige-dialog-input', type: 'file', 'aria-label': options.multiple ? 'Files' : 'File' });
            if (options.multiple) inputEl.multiple = true;
            if (options.accept) inputEl.accept = options.accept;
            body.appendChild(inputEl);
        }
        dlg.appendChild(body);

        const footer = $tag('div', { class: 'prestige-dialog-footer' });

        let settled = false;
        let detachObserver: MutationObserver | null = null;
        const dismiss = (result: DialogResult): void => {
            if (settled) return;
            settled = true;
            detachObserver?.disconnect();
            document.removeEventListener('keydown', keyHandler);
            removeModal(dlg);
            if (overlay) {
                overlay.classList.remove('active');
                window.setTimeout(() => unmount(host, overlay), 200);
            }
            if (!overlay) unmount(host, dlg);
            else dlg.remove();
            if (previousFocus instanceof HTMLElement && typeof previousFocus.focus === 'function') previousFocus.focus();
            resolve(result);
        };

        if (hasCancel) {
            const btnCancel = createBtn(options.cancelText, { variant: 'ghost' });
            btnCancel.classList.add('prestige-dialog-btn');
            btnCancel.addEventListener('click', () => {
                if (type === 'confirm') dismiss(false);
                else if (type === 'prompt') dismiss(null);
                else if (type === 'save') dismiss({ filename: null, confirmed: false });
                else if (type === 'open') dismiss(null);
            });
            footer.appendChild(btnCancel);
        }

        const btnConfirm = createBtn(options.confirmText, { variant: options.danger ? 'danger' : 'primary' });
        btnConfirm.classList.add('prestige-dialog-btn', 'prestige-dialog-btn-primary');
        btnConfirm.addEventListener('click', () => {
            switch (type) {
                case 'info':
                case 'warning':
                case 'danger':
                case 'alert':
                    dismiss(true);
                    break;
                case 'confirm':
                    dismiss(true);
                    break;
                case 'prompt':
                    dismiss(inputEl?.value ?? '');
                    break;
                case 'save':
                    dismiss({ filename: inputEl?.value ?? '', confirmed: true });
                    break;
                case 'open': {
                    const files = inputEl?.files ?? null;
                    dismiss(files && files.length ? files : null);
                    break;
                }
            }
        });
        footer.appendChild(btnConfirm);
        dlg.appendChild(footer);

        if (inputEl && type !== 'open') {
            requestAnimationFrame(() => { inputEl?.focus(); inputEl?.select(); });
        } else {
            requestAnimationFrame(() => btnConfirm.focus());
        }

        const keyHandler = (event: KeyboardEvent): void => {
            if (!isTopmostModal(dlg)) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                if (hasCancel) {
                    const cancelBtn = btnConfirm.parentElement?.querySelector<HTMLButtonElement>('.btn:not(.prestige-dialog-btn-primary)');
                    cancelBtn?.click();
                } else {
                    dismiss(true);
                }
            } else if (event.key === 'Enter' && (!inputEl || inputEl.type !== 'file')) {
                event.preventDefault();
                btnConfirm.click();
            } else {
                trapFocusWithin(dlg, event);
            }
        };
        modalStack.push(dlg);
        host._listen(document, 'keydown', keyHandler as EventListener);

        if (overlay) overlay.appendChild(dlg);
        else host._mountNode(dlg);
        if (typeof MutationObserver !== 'undefined') {
            detachObserver = new MutationObserver(() => {
                if (!dlg.isConnected) dismiss(cancelResult(type));
            });
            detachObserver.observe(document.documentElement, { childList: true, subtree: true });
        }
    });
}

/** Info dialog. Resolves `true` on dismissal. */
export function dialogInfo(host: DialogHost, o: string | DialogOptions = {}): Promise<true> {
    return dialogShow(host, { type: 'info', title: 'Info', confirmText: 'OK', ...normalizeStringOrOptions(o) }) as Promise<true>;
}

/** Warning dialog. Resolves `true` on dismissal. */
export function dialogWarning(host: DialogHost, o: string | DialogOptions = {}): Promise<true> {
    return dialogShow(host, { type: 'warning', title: 'Warning', confirmText: 'OK', ...normalizeStringOrOptions(o) }) as Promise<true>;
}

/** Danger dialog. Resolves `true` on dismissal. */
export function dialogDanger(host: DialogHost, o: string | DialogOptions = {}): Promise<true> {
    return dialogShow(host, { type: 'danger', title: 'Error', confirmText: 'OK', danger: true, ...normalizeStringOrOptions(o) }) as Promise<true>;
}

/** Alert dialog. Resolves `true` on dismissal. */
export function dialogAlert(host: DialogHost, o: string | DialogOptions = {}): Promise<true> {
    return dialogShow(host, { type: 'alert', title: 'Alert', confirmText: 'OK', ...normalizeStringOrOptions(o) }) as Promise<true>;
}

/** Confirmation dialog. Resolves `true` on confirm, `false` on cancel/escape. */
export function dialogConfirm(host: DialogHost, o: string | DialogOptions = {}): Promise<boolean> {
    return dialogShow(host, { type: 'confirm', title: 'Confirm', confirmText: 'Confirm', cancelText: 'Cancel', ...normalizeStringOrOptions(o) }) as Promise<boolean>;
}

/** Prompt dialog. Resolves the entered value or `null` on cancel. */
export function dialogPrompt(host: DialogHost, o: string | DialogOptions = {}): Promise<string | null> {
    return dialogShow(host, { type: 'prompt', title: 'Input', confirmText: 'OK', cancelText: 'Cancel', defaultValue: '', placeholder: '', ...normalizeStringOrOptions(o) }) as Promise<string | null>;
}

/** Save dialog. Resolves `{ filename, confirmed }`. */
export function dialogSave(host: DialogHost, o: string | DialogOptions = {}): Promise<SaveDialogResult> {
    return dialogShow(host, { type: 'save', title: 'Save', confirmText: 'Save', cancelText: 'Cancel', defaultValue: 'untitled.txt', ...normalizeStringOrOptions(o) }) as Promise<SaveDialogResult>;
}

/** Open-file dialog. Resolves the selected FileList or `null`. */
export function dialogOpen(host: DialogHost, o: string | DialogOptions = {}): Promise<FileList | null> {
    return dialogShow(host, { type: 'open', title: 'Open', confirmText: 'Open', cancelText: 'Cancel', ...normalizeStringOrOptions(o) }) as Promise<FileList | null>;
}

/* ── Web3 transaction security guard ─────────────────────────────────────── */

/** Security plane token (`--prestige-plane-security`). */
const SECURITY_PLANE_Z_INDEX = '999999';

/**
 * True when a visible `pointer-events: none` element overlaps the target at a
 * sample point. Browser hit testing (`elementFromPoint` / `elementsFromPoint`)
 * transparently skips such elements, including top-layer elements whose
 * computed z-index is `auto`, so stacking values cannot safely filter this
 * scan. The target's own structure and watched security-overlay subtree are
 * trusted; mutations there independently abort Web3 confirmation.
 */
function isObscuredByInertOverlay(target: HTMLElement, x: number, y: number): boolean {
    const protectedOverlay = target.closest('.prestige-security-overlay');
    let candidates: Iterable<Element> = [];
    try {
        candidates = document.querySelectorAll('*');
    } catch {
        return true;
    }
    for (const el of candidates) {
        if (el === target || target.contains(el) || el.contains(target)) continue;
        if (protectedOverlay?.contains(el)) continue;
        try {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
            const style = window.getComputedStyle(el);
            if (style.pointerEvents !== 'none') continue;
            if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') continue;
            if (style.opacity !== '' && Number(style.opacity) <= 0) continue;
            return true;
        } catch {
            return true;
        }
    }
    return false;
}

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
export function isElementVisuallySafe(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (style.opacity !== '' && Number(style.opacity) <= 0) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return false;
    const points: Array<{ x: number; y: number }> = [
        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        { x: rect.left + 2, y: rect.top + 2 },
        { x: rect.right - 2, y: rect.top + 2 },
        { x: rect.left + 2, y: rect.bottom - 2 },
        { x: rect.right - 2, y: rect.bottom - 2 },
    ];
    return points.every((pt) => {
        const topmost = document.elementFromPoint(pt.x, pt.y);
        // Accept the element itself, its descendants, or its own ancestors.
        // Rounded buttons land their inset corner samples on their parent
        // container (guard-internal chrome) — that is safe, because any
        // foreign element can only sit ABOVE the button by being inserted as a
        // sibling/overlay, never as an ancestor without mutating the watched
        // overlay subtree.
        const ownChrome = topmost === element || (topmost !== null && (element.contains(topmost) || topmost.contains(element)));
        if (!ownChrome) return false;
        return !isObscuredByInertOverlay(element, pt.x, pt.y);
    });
}

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
export function web3TransactionGuard(host: DialogHost, txDetails: Web3TransactionDetails): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const previousFocus = document.activeElement;
        const expectedDisplay = Object.freeze({
            title: `Confirm ${String(txDetails.action)}`,
            to: String(txDetails.to),
            value: `${txDetails.value.toString()} wei`,
            data: txDetails.data ? String(txDetails.data) : null,
            chain: String(txDetails.chainId),
        });
        const overlay = $tag('div', {
            class: 'prestige-web3-guard prestige-security-overlay',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': expectedDisplay.title,
        });
        overlay.style.zIndex = SECURITY_PLANE_Z_INDEX;

        const card = $tag('div', { class: 'prestige-web3-guard-card' });
        const titleEl = $tag('h3', { class: 'prestige-web3-guard-title' }, [$text(expectedDisplay.title)]);
        card.appendChild(titleEl);

        const details = $tag('dl', { class: 'prestige-web3-guard-details' });
        details.appendChild($tag('dt', {}, [$text('To')]));
        const toEl = $tag('dd', { class: 'prestige-web3-guard-mono' }, [$text(expectedDisplay.to)]);
        details.appendChild(toEl);
        details.appendChild($tag('dt', {}, [$text('Value')]));
        const valueEl = $tag('dd', { class: 'prestige-web3-guard-mono' }, [$text(expectedDisplay.value)]);
        details.appendChild(valueEl);
        let dataEl: HTMLElement | null = null;
        if (expectedDisplay.data) {
            details.appendChild($tag('dt', {}, [$text('Data')]));
            dataEl = $tag('dd', { class: 'prestige-web3-guard-mono' }, [$text(expectedDisplay.data)]);
            details.appendChild(dataEl);
        }
        details.appendChild($tag('dt', {}, [$text('Chain')]));
        const chainEl = $tag('dd', {}, [$text(expectedDisplay.chain)]);
        details.appendChild(chainEl);
        card.appendChild(details);

        const displayedValues: ReadonlyArray<readonly [HTMLElement, string]> = [
            [titleEl, expectedDisplay.title],
            [toEl, expectedDisplay.to],
            [valueEl, expectedDisplay.value],
            ...(dataEl && expectedDisplay.data ? [[dataEl, expectedDisplay.data] as const] : []),
            [chainEl, expectedDisplay.chain],
        ];

        const actions = $tag('div', { class: 'prestige-web3-guard-actions' });
        const rejectBtn = createBtn('Reject', { variant: 'ghost', type: 'button', className: 'prestige-web3-guard-reject' });
        const confirmBtn = createBtn('Confirm', { variant: 'danger', type: 'button', className: 'prestige-web3-guard-confirm' });
        actions.append(rejectBtn, confirmBtn);
        card.appendChild(actions);
        overlay.appendChild(card);

        host._mountNode(overlay);

        let settled = false;
        let observer: MutationObserver | null = null;
        let detachObserver: MutationObserver | null = null;

        // Clickjacking defense is on by default; the security.clickjackCheck
        // config option can disable it (loudly) for unusual overlay setups.
        const clickjackCheck = host.config?.security?.clickjackCheck !== false;

        const onKeydown = (event: KeyboardEvent): void => {
            if (!isTopmostModal(overlay)) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                settle(false);
                return;
            }
            trapFocusWithin(card, event);
        };
        document.addEventListener('keydown', onKeydown);

        const settle = (accepted: boolean): void => {
            if (settled) return;
            settled = true;
            document.removeEventListener('keydown', onKeydown);
            removeModal(overlay);
            if (observer) observer.disconnect();
            detachObserver?.disconnect();
            unmount(host, overlay);
            if (previousFocus instanceof HTMLElement && typeof previousFocus.focus === 'function') previousFocus.focus();
            resolve(accepted);
        };

        rejectBtn.addEventListener('click', () => settle(false));
        confirmBtn.addEventListener('click', () => {
            const hasPendingTamper = (observer?.takeRecords().length ?? 0) > 0;
            const displayIsIntact = displayedValues.every(([element, expected]) => overlay.contains(element) && element.textContent === expected);
            const visuallySafe = !clickjackCheck || isElementVisuallySafe(confirmBtn);
            settle(!hasPendingTamper && displayIsIntact && visuallySafe);
        });

        // Detect injected tampering with the modal DOM. Also watches
        // document.head so a document-level <style>/<link> injection (which
        // could reposition the buttons underneath a decoy without touching
        // the modal subtree) aborts the transaction too.
        if (typeof MutationObserver !== 'undefined') {
            observer = new MutationObserver(() => settle(false));
            observer.observe(overlay, { childList: true, subtree: true, attributes: true, characterData: true });
            observer.observe(document.head, { childList: true, subtree: true });
            detachObserver = new MutationObserver(() => {
                if (!overlay.isConnected) settle(false);
            });
            detachObserver.observe(document.documentElement, { childList: true, subtree: true });
        }
        modalStack.push(overlay);
    });
}
