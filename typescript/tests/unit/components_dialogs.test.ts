/**
 * Phase 4 verification: component primitives (data table sorting, tabs,
 * progress, stepper, segmented control), promise-based dialogs, and the Web3
 * transaction security guard (MutationObserver tamper rejection + clickjacking
 * visual-safety checks).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createAccordion,
    createDataTable,
    createField,
    createModal,
    createProgress,
    createProgressBar,
    createSegmentedControl,
    createStepper,
    createTable,
    createTabs,
} from '../../src/ui/Components.js';
import {
    dialogConfirm,
    dialogInfo,
    dialogOpen,
    dialogPrompt,
    dialogSave,
    isElementVisuallySafe,
    web3TransactionGuard,
} from '../../src/ui/Dialogs.js';
import { mockElementFromPoint, mockRect } from '../helpers/mockLayout.js';
import { TestHost } from '../helpers/testHost.js';

afterEach(() => {
    document.body.replaceChildren();
});

describe('createDataTable', () => {
    it('renders columns and handles type-safe sorting callbacks', () => {
        const onSort = vi.fn();
        interface Row { name: string; age: number; }
        const table = createDataTable<Row>({
            columns: [
                { key: 'name', label: 'Name', sortable: true },
                { key: 'age', label: 'Age', sortable: true, value: (row) => row.age },
            ],
            rows: [
                { name: 'Alice', age: 30 },
                { name: 'Bob', age: 25 },
            ],
            onSort,
        });
        document.body.appendChild(table);

        const tableEl = table.querySelector('.prestige-data-table');
        expect(tableEl).not.toBeNull();
        expect(table.querySelectorAll('thead th').length).toBe(2);
        expect(table.querySelector('thead th')?.textContent).toContain('Name');

        const sortBtn = table.querySelector<HTMLButtonElement>('.prestige-data-table-sort');
        expect(sortBtn).not.toBeNull();
        sortBtn?.click();
        expect(onSort).toHaveBeenCalledWith(expect.objectContaining({ key: 'name' }), 1, expect.any(Array));
        expect(table.querySelector('tbody tr td')?.textContent).toBe('Alice');

        table.querySelector<HTMLButtonElement>('.prestige-data-table-sort')?.click();
        expect(onSort).toHaveBeenCalledWith(expect.objectContaining({ key: 'name' }), -1, expect.any(Array));
        expect(table.querySelector('tbody tr td')?.textContent).toBe('Bob');
    });

    it('re-renders when setRows is called and shows an empty state', () => {
        interface Row { name: string; }
        const table = createDataTable<Row>({ columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'Ada' }] });
        document.body.appendChild(table);
        expect(table.querySelector('tbody tr td')?.textContent).toBe('Ada');
        table.setRows([{ name: 'Grace' }]);
        expect(table.querySelector('tbody tr td')?.textContent).toBe('Grace');
        table.setRows([]);
        expect(table.querySelector('.prestige-data-table-empty')?.textContent).toContain('No data');
    });
});

describe('component primitives', () => {
    it('createField associates labels and help while preserving caller IDs and descriptions', () => {
        const identified = document.createElement('input');
        identified.id = 'account-email';
        identified.setAttribute('aria-describedby', 'existing-description');
        const field = createField('Email', identified, 'Used for notifications.');
        const help = field.querySelector<HTMLElement>('.form-help');

        expect(field.querySelector('label')?.htmlFor).toBe('account-email');
        expect(identified.id).toBe('account-email');
        expect(help?.id).toBeTruthy();
        expect(identified.getAttribute('aria-describedby')).toBe(`existing-description ${help?.id}`);

        const generatedInput = document.createElement('input');
        const generatedField = createField('Name', generatedInput, 'Public name.');
        expect(generatedInput.id).toBeTruthy();
        expect(generatedField.querySelector('label')?.htmlFor).toBe(generatedInput.id);
        expect(generatedField.querySelector('.form-help')?.id).not.toBe(help?.id);
    });

    it('createTable appends Text, SVG, and DocumentFragment cells as nodes', () => {
        const text = document.createTextNode('Text node');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('data-cell', 'icon');
        const fragment = document.createDocumentFragment();
        const strong = document.createElement('strong');
        strong.textContent = 'Fragment node';
        fragment.appendChild(strong);

        const table = createTable(undefined, [[text, svg, fragment]]);
        const cells = table.querySelectorAll('td');
        expect(cells[0]?.firstChild).toBe(text);
        expect(cells[1]?.firstChild).toBe(svg);
        expect(cells[2]?.firstChild).toBe(strong);
        expect(table.textContent).not.toContain('[object');
    });

    it('createTabs switches panels and reports the active index', () => {
        const onChange = vi.fn();
        const tabs = createTabs([
            { label: 'General', content: 'first panel' },
            { label: 'Security', content: 'second panel' },
        ], { activeIndex: 0, onChange });
        document.body.appendChild(tabs);
        expect(tabs.getActiveIndex()).toBe(0);
        expect(tabs.querySelector('.prestige-tabs-panel')?.textContent).toBe('first panel');

        tabs.querySelectorAll<HTMLButtonElement>('button')[1]?.click();
        expect(tabs.getActiveIndex()).toBe(1);
        expect(tabs.querySelector('.prestige-tabs-panel')?.textContent).toBe('second panel');
        expect(onChange).toHaveBeenCalled();
    });

    it('createProgress clamps values and exposes setValue/getValue', () => {
        const bar = createProgress({ max: 100, value: 50 });
        expect(bar.getValue()).toBe(50);
        expect(bar.setValue(150)).toBe(100);
        expect(bar.setValue(-10)).toBe(0);
        expect(bar.getAttribute('aria-valuenow')).toBe('0');
        const legacy = createProgressBar(65, 100, { label: 'Upload' });
        expect(legacy.getValue()).toBe(65);
        expect(legacy.getAttribute('aria-label')).toBe('Upload');
    });

    it('createStepper tracks active state', () => {
        const stepper = createStepper({ steps: ['Draft', 'Review', 'Publish'], active: 0 });
        document.body.appendChild(stepper);
        expect(stepper.getActive()).toBe(0);
        expect(stepper.querySelector('.prestige-step-active')?.textContent).toContain('1');
        stepper.setActive(1);
        expect(stepper.getActive()).toBe(1);
        expect(stepper.querySelector('.prestige-step-complete')?.textContent).toContain('✓');
    });

    it('createSegmentedControl updates selection', () => {
        const onChange = vi.fn();
        const seg = createSegmentedControl({
            items: [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }],
            value: 'day',
            onChange,
        });
        document.body.appendChild(seg);
        expect(seg.getValue()).toBe('day');
        seg.querySelectorAll<HTMLButtonElement>('button')[1]?.click();
        expect(seg.getValue()).toBe('week');
        expect(onChange).toHaveBeenCalledWith('week', expect.anything());
    });

    it('createAccordion honors multiple=false exclusivity', () => {
        const acc = createAccordion({
            items: [
                { title: 'A', content: 'a', open: true },
                { title: 'B', content: 'b' },
            ],
        });
        document.body.appendChild(acc);
        acc.querySelectorAll<HTMLButtonElement>('.prestige-accordion-trigger')[1]?.click();
        const openItems = acc.querySelectorAll('.prestige-accordion-item.is-open');
        expect(openItems.length).toBe(1);
        expect(openItems[0]?.getAttribute('data-accordion-index')).toBe('1');
    });
});

describe('dialogConfirm', () => {
    it('resolves true on confirm and false on cancel', async () => {
        const host = new TestHost();
        const confirmed = dialogConfirm(host, { title: 'Delete', message: 'Proceed?', confirmText: 'Yes', cancelText: 'No' });
        document.querySelector<HTMLButtonElement>('.prestige-dialog-btn-primary')?.click();
        await expect(confirmed).resolves.toBe(true);

        const cancelled = dialogConfirm(host, { message: 'Again?' });
        document.querySelectorAll<HTMLButtonElement>('.prestige-dialog-btn')[0]?.click();
        await expect(cancelled).resolves.toBe(false);
    });

    it('dialogInfo resolves true on OK', async () => {
        const host = new TestHost();
        const promise = dialogInfo(host, 'Operation complete.');
        document.querySelector<HTMLButtonElement>('.prestige-dialog-btn-primary')?.click();
        await expect(promise).resolves.toBe(true);
    });
});

describe('dialog detach cleanup', () => {
    it('settles built-in and Web3 dialog promises when their overlays are removed externally', async () => {
        const host = new TestHost();
        const confirmPromise = dialogConfirm(host, 'Continue?');
        document.querySelector('.modal-overlay')?.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await expect(confirmPromise).resolves.toBe(false);

        const guardPromise = web3TransactionGuard(host, {
            action: 'Transfer',
            to: '0x0000000000000000000000000000000000000001',
            value: 1n,
            chainId: 1,
        });
        document.querySelector('.prestige-security-overlay')?.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await expect(guardPromise).resolves.toBe(false);
    });
});

describe('dialog input behavior', () => {
    it('allows an open dialog to be cancelled by button or Escape', async () => {
        const host = new TestHost();
        const buttonCancelled = dialogOpen(host, { message: 'Choose a file' });
        const buttons = document.querySelectorAll<HTMLButtonElement>('.prestige-dialog-btn');
        expect(buttons.length).toBe(2);
        buttons[0]?.click();
        await expect(buttonCancelled).resolves.toBeNull();

        const escapeCancelled = dialogOpen(host, { message: 'Choose another file' });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await expect(escapeCancelled).resolves.toBeNull();
    });

    it('gives prompt, save, and file inputs accessible names', async () => {
        const host = new TestHost();
        const prompt = dialogPrompt(host, { title: 'Account name' });
        expect(document.querySelector<HTMLInputElement>('.prestige-dialog-input')?.getAttribute('aria-label')).toBe('Account name');
        document.querySelector<HTMLButtonElement>('.prestige-dialog-btn')?.click();
        await prompt;

        const save = dialogSave(host);
        expect(document.querySelector<HTMLInputElement>('.prestige-dialog-input')?.getAttribute('aria-label')).toBe('Filename');
        document.querySelector<HTMLButtonElement>('.prestige-dialog-btn')?.click();
        await save;

        const open = dialogOpen(host, { multiple: true });
        expect(document.querySelector<HTMLInputElement>('.prestige-dialog-input')?.getAttribute('aria-label')).toBe('Files');
        document.querySelector<HTMLButtonElement>('.prestige-dialog-btn')?.click();
        await open;
    });

    it('lets only the topmost stacked dialog handle Enter and Escape', async () => {
        const host = new TestHost();
        const lower = dialogConfirm(host, 'Lower');
        const upper = dialogConfirm(host, 'Upper');

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await expect(upper).resolves.toBe(true);
        expect(document.querySelectorAll('.prestige-dialog')).toHaveLength(1);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await expect(lower).resolves.toBe(false);
    });
});

describe('modal focus trap', () => {
    it('wraps Tab/Shift+Tab inside a promise dialog', async () => {
        const host = new TestHost();
        const promise = dialogConfirm(host, { title: 'Delete', message: 'Proceed?' });
        const dlg = document.querySelector('.prestige-dialog');
        const buttons = Array.from(dlg?.querySelectorAll<HTMLButtonElement>('button') ?? []);
        expect(buttons.length).toBe(2);
        const [cancel, confirm] = buttons;
        if (!dlg || !cancel || !confirm) return;
        confirm.focus();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(cancel);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, shiftKey: true }));
        expect(document.activeElement).toBe(confirm);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await expect(promise).resolves.toBe(false);
    });

    it('wraps Tab/Shift+Tab inside createModal and Escape settles', async () => {
        const host = new TestHost();
        const promise = createModal({ title: 'Modal', buttons: [{ label: 'One' }, { label: 'Two' }] }, host);
        const modal = document.querySelector('.prestige-custom-modal');
        const buttons = Array.from(modal?.querySelectorAll<HTMLButtonElement>('button') ?? []);
        expect(buttons.length).toBe(2);
        if (!modal || buttons.length < 2) return;
        const [one, two] = buttons;
        one.focus();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(two);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, shiftKey: true }));
        expect(document.activeElement).toBe(one);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await expect(promise).resolves.toBeUndefined();
    });

    it('lets only the topmost stacked custom modal process Escape', async () => {
        const host = new TestHost();
        let lowerSettled = false;
        const lower = createModal({ title: 'Lower', closeValue: 'lower' }, host);
        lower.then(() => { lowerSettled = true; });
        const upper = createModal({ title: 'Upper', closeValue: 'upper' }, host);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await expect(upper).resolves.toBe('upper');
        expect(lowerSettled).toBe(false);

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await expect(lower).resolves.toBe('lower');
    });

    it('web3TransactionGuard rejects on Escape and traps focus', async () => {
        const host = new TestHost();
        const promise = web3TransactionGuard(host, {
            action: 'approve',
            to: '0x0123456789abcdef0123456789abcdef01234567' as const,
            value: 1n,
            chainId: 1,
        });
        const rejectBtn = document.querySelector<HTMLButtonElement>('.prestige-web3-guard-reject');
        expect(rejectBtn).not.toBeNull();
        if (rejectBtn) {
            rejectBtn.focus();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
            expect(document.activeElement).toBe(document.querySelector('.prestige-web3-guard-confirm'));
        }
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await expect(promise).resolves.toBe(false);
    });
});

describe('isElementVisuallySafe', () => {
    it('returns false when hidden, transparent, or zero-sized', () => {
        const el = document.createElement('button');
        document.body.appendChild(el);
        mockRect(el, { width: 0, height: 0 });
        expect(isElementVisuallySafe(el)).toBe(false);

        el.style.visibility = 'hidden';
        mockRect(el, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        expect(isElementVisuallySafe(el)).toBe(false);

        el.style.visibility = 'visible';
        el.style.opacity = '0';
        expect(isElementVisuallySafe(el)).toBe(false);

        el.style.opacity = '1';
        const covering = document.createElement('div');
        document.body.appendChild(covering);
        mockElementFromPoint(covering);
        expect(isElementVisuallySafe(el)).toBe(false);
    });

    it('returns true when visible and topmost at its center', () => {
        const el = document.createElement('button');
        document.body.appendChild(el);
        mockRect(el, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        mockElementFromPoint(el);
        expect(isElementVisuallySafe(el)).toBe(true);
    });
});

describe('web3TransactionGuard', () => {
    const tx = {
        action: 'approve',
        to: '0x0123456789abcdef0123456789abcdef01234567' as const,
        value: 1_000_000_000_000_000_000n,
        data: '0xdeadbeef' as const,
        chainId: 1,
    };

    it('resolves true when the confirm button is clicked and visually safe', async () => {
        const host = new TestHost();
        const promise = web3TransactionGuard(host, tx);
        const confirmBtn = document.querySelector<HTMLButtonElement>('.prestige-web3-guard-confirm');
        expect(confirmBtn).not.toBeNull();
        if (!confirmBtn) return;
        mockRect(confirmBtn, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        mockElementFromPoint(confirmBtn);
        confirmBtn.click();
        await expect(promise).resolves.toBe(true);
        expect(document.querySelector('.prestige-web3-guard')).toBeNull();
    });

    it('resolves false when the transaction is rejected', async () => {
        const host = new TestHost();
        const promise = web3TransactionGuard(host, tx);
        const rejectBtn = document.querySelector<HTMLButtonElement>('.prestige-web3-guard-reject');
        expect(rejectBtn).not.toBeNull();
        rejectBtn?.click();
        await expect(promise).resolves.toBe(false);
    });

    it('rejects the transaction when the modal DOM is tampered with', async () => {
        const host = new TestHost();
        const promise = web3TransactionGuard(host, tx);
        const overlay = document.querySelector('.prestige-web3-guard');
        expect(overlay).not.toBeNull();
        if (!overlay) return;
        overlay.appendChild(document.createElement('script'));
        await expect(promise).resolves.toBe(false);
        expect(document.querySelector('.prestige-web3-guard')).toBeNull();
    });

    it('rejects same-task tampering even when the displayed value is restored before confirmation', async () => {
        const host = new TestHost();
        const promise = web3TransactionGuard(host, tx);
        const confirmBtn = document.querySelector<HTMLButtonElement>('.prestige-web3-guard-confirm');
        const toEl = document.querySelector<HTMLElement>('.prestige-web3-guard-details dd');
        expect(confirmBtn).not.toBeNull();
        expect(toEl).not.toBeNull();
        if (!confirmBtn || !toEl) return;
        const original = toEl.textContent;
        toEl.textContent = '0x0000000000000000000000000000000000000000';
        toEl.textContent = original;
        mockRect(confirmBtn, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
        mockElementFromPoint(confirmBtn);
        confirmBtn.click();
        await expect(promise).resolves.toBe(false);
    });

    it('rejects changed displayed values synchronously without MutationObserver support', async () => {
        vi.stubGlobal('MutationObserver', undefined);
        try {
            const host = new TestHost();
            const promise = web3TransactionGuard(host, tx);
            const confirmBtn = document.querySelector<HTMLButtonElement>('.prestige-web3-guard-confirm');
            const toEl = document.querySelector<HTMLElement>('.prestige-web3-guard-details dd');
            expect(confirmBtn).not.toBeNull();
            expect(toEl).not.toBeNull();
            if (!confirmBtn || !toEl) return;
            toEl.textContent = '0x0000000000000000000000000000000000000000';
            mockRect(confirmBtn, { width: 120, height: 40, left: 10, top: 10, right: 130, bottom: 50 });
            mockElementFromPoint(confirmBtn);
            confirmBtn.click();
            await expect(promise).resolves.toBe(false);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('rejects when the confirm button is not visually safe', async () => {
        const host = new TestHost();
        const promise = web3TransactionGuard(host, tx);
        const confirmBtn = document.querySelector<HTMLButtonElement>('.prestige-web3-guard-confirm');
        expect(confirmBtn).not.toBeNull();
        if (!confirmBtn) return;
        mockRect(confirmBtn, { width: 0, height: 0 });
        mockElementFromPoint(confirmBtn);
        confirmBtn.click();
        await expect(promise).resolves.toBe(false);
    });
});
