/* ═══════════════════════════════════════════════════════════════════════════
   Prestige UI — Built-in Component Primitives
   TypeScript port of src/components.js + src/prestige-components.js. All DOM is
   built structurally ($tag / $text); zero innerHTML string concatenation.
   ═══════════════════════════════════════════════════════════════════════════ */
import { $tag, $text, replaceContent, trapFocusWithin } from '../utils/dom.js';
import { isSafeUrl } from '../utils/sanitize.js';
import {
    applyComponentOptions,
    defaultRegistry,
    type ComponentHost,
    type ComponentOptions,
} from './ComponentRegistry.js';

function isNode(value: unknown): value is Node {
    return typeof Node !== 'undefined' && value instanceof Node;
}

/** Append content (function-result / Node / text) to a parent. */
function appendContent(parent: Node, content: unknown, instance?: ComponentHost, trustedHtml?: boolean): void {
    let resolved = content;
    if (typeof resolved === 'function') resolved = (resolved as (i?: ComponentHost) => unknown)(instance);
    if (isNode(resolved)) { parent.appendChild(resolved); return; }
    if (resolved == null) return;
    replaceContent(parent as HTMLElement, String(resolved), trustedHtml === true, instance?.config?.security?.sanitizer);
}

function once<T extends unknown[]>(fn: (...args: T) => void): (...args: T) => void {
    let called = false;
    return (...args: T) => { if (called) return; called = true; fn(...args); };
}

let generatedComponentId = 0;

function nextComponentId(prefix: string): string {
    let id: string;
    do {
        generatedComponentId++;
        id = `${prefix}-${generatedComponentId}`;
    } while (document.getElementById(id));
    return id;
}

/**
 * Leak guard: components that attach document-level listeners remove them in
 * their explicit close()/settle() paths, but a parent re-render may remove
 * the component from the DOM directly. Observing every ancestor's `childList`
 * (cheap, no subtree scanning) detects both direct removal and whole-subtree
 * removal, then runs `cleanup` so the orphaned listener (and the subtree it
 * closes over) does not outlive the component.
 */
function selfCleanupOnDetach(el: HTMLElement, cleanup: () => void): () => void {
    if (typeof MutationObserver === 'undefined') return () => {};
    const observer = new MutationObserver(() => {
        if (!el.isConnected) {
            observer.disconnect();
            cleanup();
        }
    });
    let node: Node | null = el.parentNode;
    let attached = 0;
    while (node) {
        try {
            observer.observe(node, { childList: true });
            attached++;
        } catch (_e) { /* unattachable node (e.g. a detached Document) */ }
        node = node.parentNode;
    }
    if (attached === 0) observer.disconnect();
    return () => observer.disconnect();
}

/* ── Core primitives (src/components.js) ─────────────────────────────────── */

export interface ButtonOptions {
    variant?: 'primary' | 'success' | 'danger' | 'ghost';
    size?: 'sm';
    className?: string;
    onclick?: (event: MouseEvent) => void;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
}

/** Button factory. */
export function createBtn(text: string, opts: ButtonOptions = {}): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'btn';
    if (opts.variant) btn.classList.add(`btn-${opts.variant}`);
    if (opts.size === 'sm') btn.classList.add('btn-sm');
    if (opts.className) btn.classList.add(...opts.className.split(' '));
    btn.textContent = text;
    if (opts.onclick) btn.addEventListener('click', opts.onclick as EventListener);
    if (opts.type) btn.type = opts.type;
    if (opts.disabled) btn.disabled = true;
    return btn;
}

export interface CardOptions {
    className?: string;
}

/** Glass card with optional title header and body. */
export function createCard(title: string, bodyEl: Node | null, opts: CardOptions = {}): HTMLElement {
    const card = document.createElement('div');
    card.className = 'glass-card';
    if (opts.className) card.classList.add(...opts.className.split(' '));
    if (title) {
        const header = document.createElement('div');
        header.className = 'card-header';
        const h3 = document.createElement('h3');
        h3.textContent = title;
        header.appendChild(h3);
        card.appendChild(header);
    }
    if (bodyEl) {
        const body = document.createElement('div');
        body.className = 'card-body';
        body.append(bodyEl);
        card.appendChild(body);
    }
    return card;
}

/** Labeled form field wrapping an input. */
export function createField(labelText: string, inputEl: HTMLElement, helpText?: string): HTMLElement {
    const group = document.createElement('div');
    group.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = labelText;
    const controlId = inputEl.id || nextComponentId('prestige-field');
    if (!inputEl.id) inputEl.id = controlId;
    label.htmlFor = controlId;
    group.appendChild(label);
    group.appendChild(inputEl);
    if (helpText) {
        const help = document.createElement('div');
        help.className = 'form-help';
        help.id = nextComponentId('prestige-field-help');
        help.textContent = helpText;
        const describedBy = inputEl.getAttribute('aria-describedby')?.trim();
        inputEl.setAttribute('aria-describedby', describedBy ? `${describedBy} ${help.id}` : help.id);
        group.appendChild(help);
    }
    return group;
}

export interface InputOptions {
    placeholder?: string;
    value?: string;
    type?: string;
    required?: boolean;
    rows?: number;
    textarea?: boolean;
}

/** Input / textarea factory. */
export function createInput(opts: InputOptions = {}): HTMLInputElement | HTMLTextAreaElement {
    if (opts.textarea) {
        const el = document.createElement('textarea');
        el.className = 'form-textarea';
        if (opts.placeholder) el.placeholder = opts.placeholder;
        if (opts.value !== undefined) el.value = opts.value;
        if (opts.required) el.required = true;
        if (opts.rows) el.rows = opts.rows;
        return el;
    }
    const el = document.createElement('input');
    el.className = 'form-input';
    if (opts.placeholder) el.placeholder = opts.placeholder;
    if (opts.value !== undefined) el.value = opts.value;
    if (opts.type) el.type = opts.type;
    if (opts.required) el.required = true;
    return el;
}

/** Stat card showing a big value and a label. */
export function createStatCard(value: string | number, label: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'stat-card';
    const v = document.createElement('div');
    v.className = 'stat-value';
    v.textContent = String(value);
    const l = document.createElement('div');
    l.className = 'stat-label';
    l.textContent = label;
    card.append(v, l);
    return card;
}

export type BadgeVariant = 'info' | 'success' | 'warning' | 'danger' | 'dark';

/** Badge factory. */
export function createBadge(text: string, variant: BadgeVariant = 'info'): HTMLSpanElement {
    const b = document.createElement('span');
    b.className = `badge badge-${variant}`;
    b.textContent = text;
    return b;
}

export type TableCell = Node | string | number;

/** Plain table factory. */
export function createTable(headers?: string[], rows?: ReadonlyArray<ReadonlyArray<TableCell>>): HTMLTableElement {
    const table = document.createElement('table');
    if (headers && headers.length) {
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        for (const h of headers) {
            const th = document.createElement('th');
            th.textContent = h;
            tr.appendChild(th);
        }
        thead.appendChild(tr);
        table.appendChild(thead);
    }
    if (rows && rows.length) {
        const tbody = document.createElement('tbody');
        for (const row of rows) {
            const tr = document.createElement('tr');
            for (const cell of row) {
                const td = document.createElement('td');
                if (isNode(cell)) td.appendChild(cell);
                else td.textContent = String(cell);
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
    }
    return table;
}

/* ── Progress ────────────────────────────────────────────────────────────── */

export interface ProgressOptions extends ComponentOptions {
    value?: number | string;
    max?: number | string;
    label?: string;
}

export type ProgressBar = HTMLDivElement & {
    setValue(value: number | string): number;
    getValue(): number;
};

function buildProgress(options: ProgressOptions): ProgressBar {
    const max = Number(options.max);
    const safeMax = isFinite(max) && max > 0 ? max : 100;
    const bar = $tag('div', { class: 'prestige-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(safeMax) }) as ProgressBar;
    const fill = $tag('div', { class: 'prestige-progress-fill' });
    bar.appendChild(fill);
    const setValue = (value: number | string): number => {
        const parsed = Number(value);
        const safe = isFinite(parsed) ? Math.max(0, Math.min(safeMax, parsed)) : 0;
        fill.style.width = `${(safe / safeMax) * 100}%`;
        bar.setAttribute('aria-valuenow', String(safe));
        if (options.label) bar.setAttribute('aria-label', options.label);
        return safe;
    };
    bar.setValue = setValue;
    bar.getValue = () => Number(bar.getAttribute('aria-valuenow'));
    setValue(options.value ?? 0);
    return bar;
}

/** Progress bar factory. */
export function createProgress(options: ProgressOptions = {}): ProgressBar {
    return applyComponentOptions(buildProgress(options), options) as ProgressBar;
}

/** Backwards-compatible (value, max, options) progress factory. */
export function createProgressBar(value?: number, max?: number, options: ProgressOptions = {}): ProgressBar {
    const merged: ProgressOptions = { ...options };
    if (value !== undefined) merged.value = value;
    if (max !== undefined) merged.max = max;
    return createProgress(merged);
}

/* ── Tabs ────────────────────────────────────────────────────────────────── */

export interface TabItem {
    label?: string;
    content?: unknown;
    trustedHtml?: boolean;
    html?: boolean;
}

export interface TabsOptions extends ComponentOptions {
    tabs?: TabItem[];
    activeIndex?: number;
    size?: 'sm';
    onChange?: (tab: TabItem, index: number, container: HTMLElement) => void;
    /** Host carrying the `security.sanitizer` config for `trustedHtml` content. */
    instance?: ComponentHost;
}

export type Tabs = HTMLDivElement & {
    select(index: number): void;
    getActiveIndex(): number;
};

function buildTabs(options: TabsOptions): Tabs {
    const tabs = Array.isArray(options.tabs) ? options.tabs : [];
    const container = $tag('div', { class: 'prestige-tabs-wrap' }) as Tabs;
    const nav = $tag('div', { class: 'prestige-tabs', role: 'tablist' });
    const panel = $tag('div', { class: 'prestige-tabs-panel', role: 'tabpanel' });
    const buttons: HTMLButtonElement[] = [];
    let activeIndex = -1;
    const panelId = `prestige-tabs-${Math.random().toString(36).slice(2)}`;
    panel.id = panelId;

    const renderTab = (index: number): void => {
        const tab = tabs[index];
        if (!tab) return;
        activeIndex = index;
        buttons.forEach((button, buttonIndex) => {
            const active = buttonIndex === index;
            button.classList.toggle('btn-primary', active);
            button.classList.toggle('btn-ghost', !active);
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        while (panel.firstChild) panel.removeChild(panel.firstChild);
        appendContent(panel, tab.content, options.instance, tab.trustedHtml === true || tab.html === true);
        if (typeof options.onChange === 'function') options.onChange(tab, index, container);
    };

    tabs.forEach((tab, index) => {
        const button = createBtn(tab.label ?? `Tab ${index + 1}`, { variant: 'ghost', size: options.size ?? 'sm', type: 'button' });
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', panelId);
        button.addEventListener('click', () => renderTab(index));
        button.addEventListener('keydown', ((event: KeyboardEvent) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0
                : event.key === 'End' ? tabs.length - 1
                : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            buttons[next]?.focus();
            renderTab(next);
        }) as EventListener);
        buttons.push(button);
        nav.appendChild(button);
    });
    container.append(nav, panel);
    container.select = renderTab;
    container.getActiveIndex = () => activeIndex;
    if (tabs.length) renderTab(Math.max(0, Math.min(tabs.length - 1, Number(options.activeIndex) || 0)));
    return container;
}

/** Tabs factory. */
export function createTabs(tabs?: TabItem[], options: TabsOptions = {}): Tabs {
    const opts: TabsOptions = { ...options, tabs: tabs ?? options.tabs ?? [] };
    return applyComponentOptions(buildTabs(opts), opts) as Tabs;
}

/* ── Alert ───────────────────────────────────────────────────────────────── */

export interface AlertOptions extends ComponentOptions {
    type?: 'info' | 'success' | 'warning' | 'danger';
    title?: string;
    message?: string;
    content?: unknown;
    dismissible?: boolean;
    html?: boolean;
    onClose?: () => void;
    /** Host carrying the `security.sanitizer` config for `html` content. */
    instance?: ComponentHost;
}

/** Alert banner factory. */
export function createAlert(options: AlertOptions = {}): HTMLElement {
    const type = options.type ?? 'info';
    const alert = $tag('section', { class: `prestige-alert prestige-alert-${type}`, role: type === 'danger' ? 'alert' : 'status' });
    const content = $tag('div', { class: 'prestige-alert-content' });
    if (options.title) content.appendChild($tag('strong', { class: 'prestige-alert-title' }, [$text(options.title)]));
    if (options.message !== undefined || options.content !== undefined) {
        appendContent(content, options.content === undefined ? options.message : options.content, options.instance, options.html === true);
    }
    alert.appendChild(content);
    if (options.dismissible) {
        const close = createBtn('×', { variant: 'ghost', size: 'sm', type: 'button', className: 'prestige-alert-close' });
        close.setAttribute('aria-label', 'Dismiss alert');
        close.addEventListener('click', () => { alert.remove(); if (typeof options.onClose === 'function') options.onClose(); });
        alert.appendChild(close);
    }
    return applyComponentOptions(alert, options);
}

/* ── Switch ──────────────────────────────────────────────────────────────── */

export interface SwitchOptions extends ComponentOptions {
    checked?: boolean;
    label?: string;
    onChange?: (checked: boolean, control: HTMLButtonElement) => void;
}

export type SwitchControl = HTMLButtonElement & {
    setChecked(next: boolean): boolean;
    isChecked(): boolean;
};

function buildSwitch(options: SwitchOptions): SwitchControl {
    const checked = !!options.checked;
    const control = $tag('button', { class: 'prestige-switch', type: 'button', role: 'switch', 'aria-checked': String(checked), 'aria-label': options.label ?? 'Toggle' }) as SwitchControl;
    control.appendChild($tag('span', { class: 'prestige-switch-thumb' }));
    const setChecked = (next: boolean, notify: boolean): boolean => {
        const value = !!next;
        control.classList.toggle('is-checked', value);
        control.setAttribute('aria-checked', String(value));
        if (notify && typeof options.onChange === 'function') options.onChange(value, control);
        return value;
    };
    control.addEventListener('click', () => setChecked(control.getAttribute('aria-checked') !== 'true', true));
    control.setChecked = (next) => setChecked(next, false);
    control.isChecked = () => control.getAttribute('aria-checked') === 'true';
    return control;
}

/** Toggle switch factory. */
export function createSwitch(options: SwitchOptions = {}): SwitchControl {
    return applyComponentOptions(buildSwitch(options), options) as SwitchControl;
}

/* ── Accordion ───────────────────────────────────────────────────────────── */

export interface AccordionItem {
    title?: string;
    content?: unknown;
    open?: boolean;
    html?: boolean;
}

export interface AccordionOptions extends ComponentOptions {
    items?: AccordionItem[];
    multiple?: boolean;
    onChange?: (open: number[], root: HTMLElement) => void;
    /** Host carrying the `security.sanitizer` config for `html` content. */
    instance?: ComponentHost;
}

export type Accordion = HTMLDivElement & {
    setOpen(index: number, value: boolean): void;
};

function buildAccordion(options: AccordionOptions): Accordion {
    const items = Array.isArray(options.items) ? options.items : [];
    const multiple = !!options.multiple;
    const root = $tag('div', { class: 'prestige-accordion' }) as Accordion;
    const open: Record<number, boolean> = {};

    const setOpen = (index: number, value: boolean): void => {
        if (!multiple && value) Object.keys(open).forEach((key) => { open[Number(key)] = false; });
        open[index] = !!value;
        root.querySelectorAll<HTMLElement>('[data-accordion-index]').forEach((item) => {
            const itemIndex = item.getAttribute('data-accordion-index');
            const expanded = !!open[Number(itemIndex)];
            item.classList.toggle('is-open', expanded);
            const trigger = item.querySelector('button');
            trigger?.setAttribute('aria-expanded', String(expanded));
        });
        if (typeof options.onChange === 'function') {
            options.onChange(Object.keys(open).filter((key) => open[Number(key)]).map(Number), root);
        }
    };

    items.forEach((item, index) => {
        const section = $tag('section', { class: 'prestige-accordion-item', 'data-accordion-index': String(index) });
        const button = $tag('button', { class: 'prestige-accordion-trigger', type: 'button', 'aria-expanded': 'false' }, [
            $tag('span', {}, [$text(item.title ?? `Section ${index + 1}`)]),
            $tag('span', { class: 'prestige-accordion-chevron', 'aria-hidden': 'true' }, [$text('⌄')]),
        ]);
        const panel = $tag('div', { class: 'prestige-accordion-panel' });
        appendContent(panel, item.content, options.instance, item.html === true);
        button.addEventListener('click', () => setOpen(index, !open[index]));
        section.append(button, panel);
        root.appendChild(section);
        if (item.open) open[index] = true;
    });

    root.setOpen = setOpen;
    items.forEach((_item, index) => { if (open[index]) setOpen(index, true); });
    return root;
}

/** Accordion factory. */
export function createAccordion(options: AccordionOptions = {}): Accordion {
    return applyComponentOptions(buildAccordion(options), options) as Accordion;
}

/* ── Pagination ──────────────────────────────────────────────────────────── */

export interface PaginationOptions extends ComponentOptions {
    total?: number;
    page?: number;
    onChange?: (page: number, nav: HTMLElement) => void;
    ariaLabel?: string;
}

export type Pagination = HTMLElement & {
    setPage(page: number): number;
    getPage(): number;
};

function buildPagination(options: PaginationOptions): Pagination {
    const total = Math.max(1, Number(options.total) || 1);
    let page = Math.max(1, Math.min(total, Number(options.page) || 1));
    const nav = $tag('nav', { class: 'prestige-pagination', 'aria-label': options.ariaLabel ?? 'Pagination' }) as Pagination;

    const render = (): void => {
        while (nav.firstChild) nav.removeChild(nav.firstChild);
        const previous = createBtn('Previous', { variant: 'ghost', size: 'sm', type: 'button', disabled: page === 1 });
        previous.addEventListener('click', () => setPage(page - 1));
        nav.appendChild(previous);
        for (let number = 1; number <= total; number++) {
            const button = createBtn(String(number), { variant: number === page ? 'primary' : 'ghost', size: 'sm', type: 'button' });
            button.setAttribute('aria-current', number === page ? 'page' : 'false');
            button.addEventListener('click', () => setPage(number));
            nav.appendChild(button);
        }
        const next = createBtn('Next', { variant: 'ghost', size: 'sm', type: 'button', disabled: page === total });
        next.addEventListener('click', () => setPage(page + 1));
        nav.appendChild(next);
    };

    const setPage = (next: number): number => {
        const target = Math.max(1, Math.min(total, Number(next) || page));
        if (target === page) return page;
        page = target;
        render();
        if (typeof options.onChange === 'function') options.onChange(page, nav);
        return page;
    };

    nav.setPage = setPage;
    nav.getPage = () => page;
    render();
    return nav;
}

/** Pagination factory. */
export function createPagination(options: PaginationOptions = {}): Pagination {
    return applyComponentOptions(buildPagination(options), options) as Pagination;
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */

export interface SkeletonOptions extends ComponentOptions {
    count?: number;
    widths?: string[];
    width?: string;
    height?: string;
    label?: string;
}

/** Skeleton loader factory. */
export function createSkeleton(options: SkeletonOptions = {}): HTMLElement {
    const count = Math.max(1, Number(options.count) || 1);
    const root = $tag('div', { class: 'prestige-skeleton-group', role: 'status', 'aria-label': options.label ?? 'Loading' });
    for (let index = 0; index < count; index++) {
        const line = $tag('div', { class: 'prestige-skeleton' });
        line.style.width = (Array.isArray(options.widths) ? options.widths[index] : options.width) || '100%';
        line.style.height = options.height || '14px';
        root.appendChild(line);
    }
    return applyComponentOptions(root, options);
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

export interface EmptyStateAction {
    label?: string;
    variant?: ButtonOptions['variant'];
    onClick?: (event: MouseEvent) => void;
}

export interface EmptyStateOptions extends ComponentOptions {
    icon?: string;
    title?: string;
    description?: string;
    action?: EmptyStateAction;
}

/** Empty state placeholder factory. */
export function createEmptyState(options: EmptyStateOptions = {}): HTMLElement {
    const root = $tag('section', { class: 'prestige-empty-state' });
    if (options.icon) root.appendChild($tag('div', { class: 'prestige-empty-state-icon', 'aria-hidden': 'true' }, [$text(options.icon)]));
    root.appendChild($tag('h3', {}, [$text(options.title ?? 'Nothing here yet')]));
    if (options.description) root.appendChild($tag('p', {}, [$text(options.description)]));
    if (options.action) {
        const action = createBtn(options.action.label ?? 'Continue', { variant: options.action.variant ?? 'primary', type: 'button' });
        if (typeof options.action.onClick === 'function') action.addEventListener('click', options.action.onClick as EventListener);
        root.appendChild(action);
    }
    return applyComponentOptions(root, options);
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */

export interface AvatarOptions extends ComponentOptions {
    name?: string;
    label?: string;
    initials?: string;
    size?: 'sm' | 'md' | 'lg';
    href?: string;
    src?: string;
    alt?: string;
    ariaLabel?: string;
}

function appendAvatarBody(el: HTMLElement, options: AvatarOptions, initials: string): void {
    if (options.src && isSafeUrl(options.src)) {
        const image = $tag('img', { src: options.src, alt: options.alt ?? options.label ?? '' });
        image.addEventListener('error', () => { image.remove(); el.appendChild($text(initials)); }, { once: true });
        el.appendChild(image);
    } else {
        el.appendChild($text(initials));
    }
}

/** Avatar factory (initials or image). */
export function createAvatar(options: AvatarOptions = {}): HTMLElement {
    const label = options.label ?? options.name ?? '';
    const initials = options.initials
        ?? label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase()
        ?? '?';
    const ariaLabel = options.ariaLabel ?? label ?? 'Avatar';
    if (options.href && isSafeUrl(options.href)) {
        const avatar = $tag('a', { class: `prestige-avatar prestige-avatar-${options.size ?? 'md'}`, 'aria-label': ariaLabel, href: options.href });
        appendAvatarBody(avatar, options, initials);
        return applyComponentOptions(avatar, options);
    }
    const avatar = $tag('span', { class: `prestige-avatar prestige-avatar-${options.size ?? 'md'}`, 'aria-label': ariaLabel });
    appendAvatarBody(avatar, options, initials);
    return applyComponentOptions(avatar, options);
}

/* ── Breadcrumb ──────────────────────────────────────────────────────────── */

export interface BreadcrumbItem {
    label?: string;
    href?: string;
}

export interface BreadcrumbOptions extends ComponentOptions {
    items?: BreadcrumbItem[];
    ariaLabel?: string;
}

/** Breadcrumb factory. */
export function createBreadcrumb(options: BreadcrumbOptions = {}): HTMLElement {
    const items = Array.isArray(options.items) ? options.items : [];
    const nav = $tag('nav', { class: 'prestige-breadcrumb', 'aria-label': options.ariaLabel ?? 'Breadcrumb' });
    const list = $tag('ol');
    items.forEach((item, index) => {
        const entry = $tag('li');
        const current = index === items.length - 1;
        if (item.href && !current && isSafeUrl(item.href)) {
            entry.appendChild($tag('a', { href: item.href }, [$text(item.label ?? '')]));
        } else {
            entry.appendChild($tag('span', current ? { 'aria-current': 'page' } : undefined, [$text(item.label ?? '')]));
        }
        list.appendChild(entry);
    });
    nav.appendChild(list);
    return applyComponentOptions(nav, options);
}

/* ── Tooltip ─────────────────────────────────────────────────────────────── */

export interface TooltipOptions extends ComponentOptions {
    trigger?: Element;
    message?: string;
    id?: string;
}

/** Tooltip factory wrapping a trigger node. */
export function createTooltip(options: TooltipOptions = {}): HTMLElement {
    if (!(options.trigger instanceof Element)) throw new Error('Tooltip requires a trigger DOM node.');
    const wrapper = $tag('span', { class: 'prestige-tooltip-wrap' });
    const bubble = $tag('span', { class: 'prestige-tooltip', role: 'tooltip' }, [$text(options.message ?? '')]);
    wrapper.append(options.trigger, bubble);
    const id = options.id ?? `prestige-tooltip-${Math.random().toString(36).slice(2)}`;
    options.trigger.setAttribute('aria-describedby', id);
    bubble.id = id;
    return applyComponentOptions(wrapper, options);
}

/* ── Dropdown ────────────────────────────────────────────────────────────── */

export interface DropdownItem {
    label?: string;
    divider?: boolean;
    danger?: boolean;
    disabled?: boolean;
    onClick?: (item: DropdownItem, root: HTMLElement) => void;
}

export interface DropdownOptions extends ComponentOptions {
    items?: DropdownItem[];
    label?: string;
    variant?: ButtonOptions['variant'];
    trigger?: HTMLElement;
}

export type Dropdown = HTMLDivElement & {
    close(): void;
    isOpen(): boolean;
};

function buildDropdown(options: DropdownOptions, instance?: ComponentHost): Dropdown {
    const items = Array.isArray(options.items) ? options.items : [];
    const root = $tag('div', { class: 'prestige-dropdown' }) as Dropdown;
    const trigger = options.trigger ?? createBtn(options.label ?? 'Options', { variant: options.variant ?? 'ghost', type: 'button' });
    const menu = $tag('div', { class: 'prestige-dropdown-menu', role: 'menu' });
    let open = false;
    let listening = false;
    let stopWatchingDetach: (() => void) | null = null;

    const onDocumentClick = (event: MouseEvent): void => {
        if (!root.contains(event.target as Node)) close();
    };

    const close = (): void => {
        open = false;
        root.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        if (listening) {
            document.removeEventListener('click', onDocumentClick as EventListener);
            listening = false;
        }
        stopWatchingDetach?.();
        stopWatchingDetach = null;
    };

    const toggle = (): void => {
        if (open) { close(); return; }
        open = true;
        root.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        if (instance?._listen) instance._listen(document, 'click', onDocumentClick as EventListener);
        else document.addEventListener('click', onDocumentClick as EventListener);
        listening = true;
        stopWatchingDetach = selfCleanupOnDetach(root, close);
    };

    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', (event) => { event.preventDefault(); toggle(); });

    items.forEach((item) => {
        if (item.divider) { menu.appendChild($tag('div', { class: 'prestige-dropdown-divider', role: 'separator' })); return; }
        const choice = $tag('button', { class: `prestige-dropdown-item${item.danger ? ' is-danger' : ''}`, type: 'button', role: 'menuitem' }, [$text(item.label ?? '')]);
        choice.disabled = !!item.disabled;
        choice.addEventListener('click', () => { if (typeof item.onClick === 'function') item.onClick(item, root); close(); });
        menu.appendChild(choice);
    });

    root.append(trigger, menu);
    root.close = close;
    root.isOpen = () => open;
    return root;
}

/** Dropdown menu factory. */
export function createDropdown(options: DropdownOptions = {}, instance?: ComponentHost): Dropdown {
    return applyComponentOptions(buildDropdown(options, instance), options) as Dropdown;
}

/* ── Stepper ─────────────────────────────────────────────────────────────── */

export interface StepperOptions extends ComponentOptions {
    steps?: Array<string | { label?: string }>;
    active?: number;
    onChange?: (active: number, root: HTMLElement) => void;
}

export type Stepper = HTMLOListElement & {
    setActive(index: number): number;
    getActive(): number;
};

function buildStepper(options: StepperOptions): Stepper {
    const steps = Array.isArray(options.steps) ? options.steps : [];
    let active = Math.max(0, Math.min(steps.length - 1, Number(options.active) || 0));
    const root = $tag('ol', { class: 'prestige-stepper' }) as Stepper;

    const render = (): void => {
        while (root.firstChild) root.removeChild(root.firstChild);
        steps.forEach((step, index) => {
            const state = index < active ? 'complete' : index === active ? 'active' : 'pending';
            const item = $tag('li', { class: `prestige-step prestige-step-${state}` });
            item.append(
                $tag('span', { class: 'prestige-step-index' }, [$text(index < active ? '✓' : String(index + 1))]),
                $tag('span', { class: 'prestige-step-label' }, [$text(typeof step === 'string' ? step : step.label ?? '')]),
            );
            root.appendChild(item);
        });
    };

    const setActive = (index: number): number => {
        active = Math.max(0, Math.min(steps.length - 1, Number(index) || 0));
        render();
        if (typeof options.onChange === 'function') options.onChange(active, root);
        return active;
    };

    root.setActive = setActive;
    root.getActive = () => active;
    render();
    return root;
}

/** Stepper factory. */
export function createStepper(options: StepperOptions = {}): Stepper {
    return applyComponentOptions(buildStepper(options), options) as Stepper;
}

/* ── Data table ──────────────────────────────────────────────────────────── */

export interface DataTableColumn<T extends object> {
    key: keyof T;
    label?: string;
    sortable?: boolean;
    value?: (row: T) => unknown;
    html?: boolean;
}

export interface DataTableOptions<T extends object> extends ComponentOptions {
    columns?: DataTableColumn<T>[];
    rows?: T[];
    onRowClick?: (row: T, index: number, tr: HTMLTableRowElement) => void;
    onSort?: (column: DataTableColumn<T>, direction: 1 | -1, rows: T[]) => void;
    emptyMessage?: string;
    /** Host carrying the `security.sanitizer` config for `html` columns. */
    instance?: ComponentHost;
}

export type DataTable<T extends object> = HTMLDivElement & {
    setRows(nextRows: T[]): void;
    getRows(): T[];
};

type DataRow = Record<string, unknown>;

function buildDataTable(options: DataTableOptions<DataRow>): DataTable<DataRow> {
    const columns = Array.isArray(options.columns) ? options.columns : [];
    let rows = Array.isArray(options.rows) ? options.rows.slice() : [];
    const sort: { key: string | null; direction: 1 | -1 } = { key: null, direction: 1 };
    const wrapper = $tag('div', { class: 'prestige-data-table-wrap' }) as DataTable<DataRow>;
    const table = $tag('table', { class: 'prestige-data-table' });
    const head = $tag('thead');
    const body = $tag('tbody');
    table.append(head, body);
    wrapper.appendChild(table);

    const valueFor = (row: DataRow, column: DataTableColumn<DataRow>): unknown =>
        typeof column.value === 'function' ? column.value(row) : row[column.key];

    const render = (): void => {
        while (head.firstChild) head.removeChild(head.firstChild);
        while (body.firstChild) body.removeChild(body.firstChild);

        const headerRow = $tag('tr');
        columns.forEach((column) => {
            const heading = $tag('th');
            if (column.sortable) {
                const button = $tag('button', { class: 'prestige-data-table-sort', type: 'button' }, [$text(column.label ?? String(column.key))]);
                if (sort.key === column.key) button.appendChild($text(sort.direction === 1 ? ' ↑' : ' ↓'));
                button.addEventListener('click', () => {
                    sort.direction = sort.key === column.key ? (sort.direction === 1 ? -1 : 1) : 1;
                    sort.key = String(column.key);
                    rows.sort((a, b) => String(valueFor(a, column) ?? '').localeCompare(String(valueFor(b, column) ?? ''), undefined, { numeric: true }) * sort.direction);
                    render();
                    if (typeof options.onSort === 'function') options.onSort(column, sort.direction, rows.slice());
                });
                heading.appendChild(button);
            } else {
                heading.appendChild($text(column.label ?? String(column.key)));
            }
            headerRow.appendChild(heading);
        });
        head.appendChild(headerRow);

        rows.forEach((row, rowIndex) => {
            const tr = $tag('tr');
            columns.forEach((column) => {
                const cell = $tag('td');
                appendContent(cell, valueFor(row, column), options.instance, column.html === true);
                tr.appendChild(cell);
            });
            const onRowClick = options.onRowClick;
            if (typeof onRowClick === 'function') {
                tr.tabIndex = 0;
                tr.classList.add('is-clickable');
                tr.addEventListener('click', () => onRowClick(row, rowIndex, tr));
            }
            body.appendChild(tr);
        });

        if (!rows.length) {
            const empty = $tag('tr');
            const cell = $tag('td', { colspan: String(Math.max(1, columns.length)), class: 'prestige-data-table-empty' }, [$text(options.emptyMessage ?? 'No data available.')]);
            empty.appendChild(cell);
            body.appendChild(empty);
        }
    };

    wrapper.setRows = (nextRows) => { rows = Array.isArray(nextRows) ? nextRows.slice() : []; render(); };
    wrapper.getRows = () => rows.slice();
    render();
    return wrapper;
}

/** Sortable data table factory (type-safe columns/rows). */
export function createDataTable<T extends object>(options: DataTableOptions<T> = {}): DataTable<T> {
    return applyComponentOptions(buildDataTable(options as unknown as DataTableOptions<DataRow>), options) as DataTable<T>;
}

/* ── Checkbox ────────────────────────────────────────────────────────────── */

export interface CheckboxOptions extends ComponentOptions {
    label?: string;
    checked?: boolean;
    disabled?: boolean;
    name?: string;
    onChange?: (checked: boolean, input: HTMLInputElement) => void;
}

export type CheckboxControl = HTMLLabelElement & {
    input: HTMLInputElement;
    setChecked(value: boolean): boolean;
    isChecked(): boolean;
};

function buildCheckbox(options: CheckboxOptions): CheckboxControl {
    const label = $tag('label', { class: 'prestige-check-control' }) as CheckboxControl;
    const input = $tag('input', { type: 'checkbox', name: options.name ?? '' });
    input.checked = !!options.checked;
    input.disabled = !!options.disabled;
    const marker = $tag('span', { class: 'prestige-check-marker', 'aria-hidden': 'true' });
    label.append(input, marker, $tag('span', { class: 'prestige-check-label' }, [$text(options.label ?? '')]));
    input.addEventListener('change', () => { if (typeof options.onChange === 'function') options.onChange(input.checked, input); });
    label.input = input;
    label.setChecked = (value) => { input.checked = !!value; return input.checked; };
    label.isChecked = () => input.checked;
    return label;
}

/** Checkbox factory. */
export function createCheckbox(options: CheckboxOptions = {}): CheckboxControl {
    return applyComponentOptions(buildCheckbox(options), options) as CheckboxControl;
}

/* ── Radio group ─────────────────────────────────────────────────────────── */

export interface RadioItem {
    value?: string | number;
    label?: string;
    checked?: boolean;
    disabled?: boolean;
}

export interface RadioGroupOptions extends ComponentOptions {
    label?: string;
    name?: string;
    value?: string | number;
    items?: RadioItem[];
    onChange?: (value: string | number | undefined, group: HTMLElement) => void;
}

export type RadioGroup = HTMLDivElement & {
    setValue(value: string | number): string | number | undefined;
    getValue(): string | number | undefined;
};

function buildRadioGroup(options: RadioGroupOptions): RadioGroup {
    const items = Array.isArray(options.items) ? options.items : [];
    const group = $tag('div', { class: 'prestige-radio-group', role: 'radiogroup', 'aria-label': options.label ?? 'Options' }) as RadioGroup;
    const name = options.name ?? `prestige-radio-${Math.random().toString(36).slice(2)}`;
    let selected: string | number | undefined = options.value;

    const setValue = (value: string | number, notify: boolean): string | number | undefined => {
        selected = value;
        group.querySelectorAll<HTMLInputElement>('input').forEach((input) => { input.checked = input.value === String(value); });
        if (notify && typeof options.onChange === 'function') options.onChange(selected, group);
        return selected;
    };

    items.forEach((item, index) => {
        const itemValue = item.value === undefined ? String(index) : item.value;
        const control = $tag('label', { class: 'prestige-check-control prestige-radio-control' });
        const input = $tag('input', { type: 'radio', name, value: String(itemValue) });
        input.checked = selected === undefined ? !!item.checked : String(selected) === String(itemValue);
        input.disabled = !!item.disabled;
        control.append(
            input,
            $tag('span', { class: 'prestige-check-marker', 'aria-hidden': 'true' }),
            $tag('span', { class: 'prestige-check-label' }, [$text(item.label ?? '')]),
        );
        input.addEventListener('change', () => { if (input.checked) setValue(itemValue, true); });
        group.appendChild(control);
        if (input.checked) selected = itemValue;
    });

    group.setValue = (value) => setValue(value, false);
    group.getValue = () => selected;
    return group;
}

/** Radio group factory. */
export function createRadioGroup(options: RadioGroupOptions = {}): RadioGroup {
    return applyComponentOptions(buildRadioGroup(options), options) as RadioGroup;
}

/* ── Select ──────────────────────────────────────────────────────────────── */

export type SelectItem = string | { value?: string | number; label?: string; disabled?: boolean };

export interface SelectOptions extends ComponentOptions {
    options?: SelectItem[];
    value?: string | number;
    name?: string;
    disabled?: boolean;
    multiple?: boolean;
    label?: string;
    ariaLabel?: string;
    onChange?: (value: string, select: HTMLSelectElement) => void;
}

export type SelectControl = HTMLSelectElement & {
    setValue(value: string): string;
    getValue(): string;
};

function buildSelect(options: SelectOptions): SelectControl {
    const select = $tag('select', { class: 'form-select', name: options.name ?? '', 'aria-label': options.ariaLabel ?? options.label ?? 'Select' }) as SelectControl;
    select.disabled = !!options.disabled;
    select.multiple = !!options.multiple;
    (options.options ?? []).forEach((item) => {
        const value = typeof item === 'object' ? item.value : item;
        const label = typeof item === 'object' ? item.label : item;
        const option = $tag('option', { value: value === undefined ? '' : String(value) }, [$text(label === undefined ? '' : String(label))]);
        option.disabled = !!(typeof item === 'object' && item.disabled);
        option.selected = options.value !== undefined && String(options.value) === String(value);
        select.appendChild(option);
    });
    select.addEventListener('change', () => { if (typeof options.onChange === 'function') options.onChange(select.value, select); });
    select.setValue = (value) => { select.value = value; return select.value; };
    select.getValue = () => select.value;
    return select;
}

/** Select dropdown factory. */
export function createSelect(options: SelectOptions = {}): SelectControl {
    return applyComponentOptions(buildSelect(options), options) as SelectControl;
}

/* ── Textarea ────────────────────────────────────────────────────────────── */

export interface TextareaOptions extends InputOptions, ComponentOptions {
    onChange?: (value: string, textarea: HTMLTextAreaElement) => void;
}

export type TextareaControl = HTMLTextAreaElement & {
    setValue(value: string): string;
    getValue(): string;
};

function buildTextarea(options: TextareaOptions): TextareaControl {
    const textarea = $tag('textarea', { class: 'form-textarea', placeholder: options.placeholder ?? '' }) as TextareaControl;
    if (options.value !== undefined) textarea.value = options.value;
    if (options.required) textarea.required = true;
    if (options.rows) textarea.rows = options.rows;
    textarea.setValue = (value) => { textarea.value = value == null ? '' : String(value); return textarea.value; };
    textarea.getValue = () => textarea.value;
    const onChange = options.onChange;
    if (typeof onChange === 'function') {
        textarea.addEventListener('input', () => onChange(textarea.value, textarea));
    }
    return textarea;
}

/** Textarea factory. */
export function createTextarea(options: TextareaOptions = {}): TextareaControl {
    return applyComponentOptions(buildTextarea(options), options) as TextareaControl;
}

/* ── Input group ─────────────────────────────────────────────────────────── */

export interface InputGroupOptions extends ComponentOptions {
    prefix?: unknown;
    suffix?: unknown;
    input?: InputOptions;
    placeholder?: string;
    value?: string;
}

export type InputGroup = HTMLDivElement & {
    input: HTMLInputElement;
    setValue(value: string): string;
    getValue(): string;
};

function buildInputGroup(options: InputGroupOptions): InputGroup {
    const group = $tag('div', { class: 'prestige-input-group' }) as InputGroup;
    if (options.prefix) appendContent(group, options.prefix);
    const inputOptions: InputOptions = {};
    if (options.placeholder !== undefined) inputOptions.placeholder = options.placeholder;
    if (options.value !== undefined) inputOptions.value = options.value;
    const input = createInput(options.input ?? inputOptions) as HTMLInputElement;
    group.appendChild(input);
    if (options.suffix) appendContent(group, options.suffix);
    group.input = input;
    group.setValue = (value) => { input.value = value == null ? '' : String(value); return input.value; };
    group.getValue = () => input.value;
    return group;
}

/** Input group (prefix / input / suffix) factory. */
export function createInputGroup(options: InputGroupOptions = {}): InputGroup {
    return applyComponentOptions(buildInputGroup(options), options) as InputGroup;
}

/* ── Segmented control ───────────────────────────────────────────────────── */

export interface SegmentedItem {
    value?: string | number;
    label?: string;
    disabled?: boolean;
}

export interface SegmentedControlOptions extends ComponentOptions {
    items?: SegmentedItem[];
    value?: string | number;
    label?: string;
    onChange?: (value: string | number | undefined, root: HTMLElement) => void;
}

export type SegmentedControl = HTMLDivElement & {
    setValue(value: string | number): string | number | undefined;
    getValue(): string | number | undefined;
};

function buildSegmentedControl(options: SegmentedControlOptions): SegmentedControl {
    const items = Array.isArray(options.items) ? options.items : [];
    let value: string | number | undefined = options.value === undefined && items.length ? items[0]?.value : options.value;
    const root = $tag('div', { class: 'prestige-segmented-control', role: 'group', 'aria-label': options.label ?? 'Segmented control' }) as SegmentedControl;

    const setValue = (next: string | number, notify: boolean): string | number | undefined => {
        value = next;
        root.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
            button.classList.toggle('is-selected', button.getAttribute('data-value') === String(value));
        });
        if (notify && typeof options.onChange === 'function') options.onChange(value, root);
        return value;
    };

    items.forEach((item, index) => {
        const itemValue = item.value === undefined ? String(index) : item.value;
        const button = createBtn(item.label ?? String(itemValue), { variant: 'ghost', size: 'sm', type: 'button', disabled: !!item.disabled });
        button.setAttribute('data-value', String(itemValue));
        button.addEventListener('click', () => setValue(itemValue, true));
        root.appendChild(button);
    });

    root.setValue = (next) => setValue(next, false);
    root.getValue = () => value;
    setValue(value === undefined ? '' : value, false);
    return root;
}

/** Segmented control factory. */
export function createSegmentedControl(options: SegmentedControlOptions = {}): SegmentedControl {
    return applyComponentOptions(buildSegmentedControl(options), options) as SegmentedControl;
}

/* ── Search input ────────────────────────────────────────────────────────── */

export interface SearchInputOptions extends ComponentOptions {
    placeholder?: string;
    ariaLabel?: string;
    value?: string;
    onChange?: (value: string, input: HTMLInputElement) => void;
}

export type SearchInput = HTMLDivElement & {
    input: HTMLInputElement;
    setValue(value: string): string;
    getValue(): string;
};

function buildSearchInput(options: SearchInputOptions): SearchInput {
    const root = $tag('div', { class: 'prestige-search-input' }) as SearchInput;
    const input = $tag('input', { class: 'form-input', type: 'search', placeholder: options.placeholder ?? '' });
    input.setAttribute('aria-label', options.ariaLabel ?? options.placeholder ?? 'Search');
    if (options.value !== undefined) input.value = options.value;
    const clear = createBtn('×', { variant: 'ghost', size: 'sm', type: 'button', className: 'prestige-search-clear' });

    const refresh = (): void => { clear.hidden = !input.value; };

    input.addEventListener('input', () => { refresh(); if (typeof options.onChange === 'function') options.onChange(input.value, input); });
    clear.addEventListener('click', () => {
        input.value = '';
        refresh();
        input.focus();
        if (typeof options.onChange === 'function') options.onChange('', input);
    });

    root.append(input, clear);
    root.input = input;
    root.setValue = (value) => { input.value = value == null ? '' : String(value); refresh(); return input.value; };
    root.getValue = () => input.value;
    refresh();
    return root;
}

/** Search input factory. */
export function createSearchInput(options: SearchInputOptions = {}): SearchInput {
    return applyComponentOptions(buildSearchInput(options), options) as SearchInput;
}

/* ── File input ──────────────────────────────────────────────────────────── */

export interface FileInputOptions extends ComponentOptions {
    label?: string;
    accept?: string;
    name?: string;
    multiple?: boolean;
    placeholder?: string;
    onChange?: (files: File[], input: HTMLInputElement) => void;
}

export type FileInput = HTMLLabelElement & {
    input: HTMLInputElement;
    getFiles(): File[];
};

function buildFileInput(options: FileInputOptions): FileInput {
    const root = $tag('label', { class: 'prestige-file-input' }) as FileInput;
    const input = $tag('input', { type: 'file', accept: options.accept ?? '', name: options.name ?? '' });
    input.multiple = !!options.multiple;
    input.hidden = true;
    const label = $tag('span', { class: 'btn btn-ghost btn-sm' }, [$text(options.label ?? 'Choose file')]);
    const filename = $tag('span', { class: 'prestige-file-name' }, [$text(options.placeholder ?? 'No file selected')]);
    input.addEventListener('change', () => {
        const files = Array.prototype.slice.call(input.files ?? []) as File[];
        filename.textContent = files.length
            ? files.map((file) => file.name).join(', ')
            : (options.placeholder ?? 'No file selected');
        if (typeof options.onChange === 'function') options.onChange(files, input);
    });
    root.append(input, label, filename);
    root.input = input;
    root.getFiles = () => Array.prototype.slice.call(input.files ?? []) as File[];
    return root;
}

/** File input factory. */
export function createFileInput(options: FileInputOptions = {}): FileInput {
    return applyComponentOptions(buildFileInput(options), options) as FileInput;
}

/* ── Toast ───────────────────────────────────────────────────────────────── */

export type ToastType = 'info' | 'success' | 'warning' | 'error';
export type ToastCloseReason = 'timeout' | 'manual';

export interface ToastOptions {
    message?: unknown;
    type?: ToastType;
    duration?: number;
    container?: HTMLElement;
    content?: unknown;
    html?: boolean;
    role?: string;
    onClose?: (reason: ToastCloseReason, element: HTMLElement) => void;
}

export type ToastApi = {
    element: HTMLElement;
    close(): void;
};

/** Toast factory. */
export function createToast(options: ToastOptions, host: ComponentHost): ToastApi {
    const toastType = options.type ?? 'info';
    const timeout = options.duration === undefined ? 3500 : Number(options.duration);
    let hostEl = options.container ?? (host._query ? host._query('#prestige-toast-container') as HTMLElement | null : null);
    if (!hostEl) {
        hostEl = $tag('div', { id: 'prestige-toast-container', class: 'prestige-toast-container', 'aria-live': 'polite', 'aria-atomic': 'true' });
        if (host._mountNode) host._mountNode(hostEl);
        else document.body.appendChild(hostEl);
    }
    const toast = $tag('div', { class: `prestige-toast prestige-toast-${toastType}`, role: options.role ?? (toastType === 'error' ? 'alert' : 'status') });
    appendContent(toast, options.content === undefined ? String(options.message ?? '') : options.content, host, options.html === true);
    hostEl.appendChild(toast);

    const close = once((reason: ToastCloseReason) => {
        toast.classList.remove('is-visible');
        window.setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 220);
        if (typeof options.onClose === 'function') options.onClose(reason, toast);
    });
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    const timer = timeout > 0 ? window.setTimeout(() => close('timeout'), timeout) : null;

    return {
        element: toast,
        close: () => { if (timer !== null) window.clearTimeout(timer); close('manual'); },
    };
}

/* ── Custom modal ────────────────────────────────────────────────────────── */

/** Why a custom modal completed, including removal by external DOM owners. */
export type ModalCloseReason = 'escape' | 'backdrop' | 'action' | 'detach';

const customModalStack: HTMLElement[] = [];

function isTopmostCustomModal(overlay: HTMLElement): boolean {
    while (customModalStack.length && !customModalStack[customModalStack.length - 1]?.isConnected) customModalStack.pop();
    return customModalStack[customModalStack.length - 1] === overlay;
}

function removeCustomModal(overlay: HTMLElement): void {
    const index = customModalStack.lastIndexOf(overlay);
    if (index !== -1) customModalStack.splice(index, 1);
}

export interface ModalButtonConfig {
    label?: string;
    variant?: ButtonOptions['variant'];
    value?: unknown;
    disabled?: boolean;
}

export interface ModalOptions {
    title?: string;
    ariaLabel?: string;
    width?: number;
    body?: unknown;
    trustedHtml?: boolean;
    buttons?: ModalButtonConfig[];
    closeOnEscape?: boolean;
    closeOnBackdrop?: boolean;
    /** Value returned for Escape, backdrop, and external-detach dismissal. */
    closeValue?: unknown;
    onClose?: (value: unknown, reason: ModalCloseReason) => void;
}

/** Custom modal factory returning a promise resolving to the clicked button value. */
export function createModal(options: ModalOptions, host: ComponentHost): Promise<unknown> {
    const buttons = Array.isArray(options.buttons) && options.buttons.length
        ? options.buttons
        : [{ label: 'Close', variant: 'primary' as const, value: true }];
    return new Promise<unknown>((resolve) => {
        const previousFocus = document.activeElement;
        const overlay = $tag('div', { class: 'modal-overlay active prestige-custom-modal-overlay', role: 'presentation' });
        const modal = $tag('div', { class: 'modal prestige-custom-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': options.ariaLabel ?? options.title ?? 'Dialog' });
        if (options.width) modal.style.maxWidth = `${String(options.width)}px`;
        const title = $tag('h3', { class: 'prestige-custom-modal-title' }, [$text(options.title ?? 'Custom Modal')]);
        const body = $tag('div', { class: 'prestige-custom-modal-body' });
        const actions = $tag('div', { class: 'modal-actions' });
        modal.append(title, body, actions);
        overlay.appendChild(modal);
        if (host._mountNode) host._mountNode(overlay);
        else document.body.appendChild(overlay);
        appendContent(body, options.body, host, options.trustedHtml === true);
        customModalStack.push(overlay);
        let stopWatchingDetach: () => void = () => {};

        const settle = once((value: unknown, reason: ModalCloseReason) => {
            document.removeEventListener('keydown', onKeydown);
            stopWatchingDetach();
            removeCustomModal(overlay);
            overlay.classList.remove('active');
            resolve(value);
            const finish = (): void => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                if (previousFocus instanceof HTMLElement && typeof previousFocus.focus === 'function') previousFocus.focus();
                if (typeof options.onClose === 'function') options.onClose(value, reason);
            };
            if (reason === 'detach') finish();
            else window.setTimeout(finish, 200);
        });

        const onKeydown = (event: KeyboardEvent): void => {
            if (!isTopmostCustomModal(overlay)) return;
            if (event.key === 'Escape' && options.closeOnEscape !== false) settle(options.closeValue, 'escape');
            else trapFocusWithin(modal, event);
        };
        if (host._listen) host._listen(document, 'keydown', onKeydown as EventListener);
        else document.addEventListener('keydown', onKeydown as EventListener);
        stopWatchingDetach = selfCleanupOnDetach(overlay, () => settle(options.closeValue, 'detach'));
        if (options.closeOnBackdrop !== false) {
            overlay.addEventListener('click', (event) => { if (event.target === overlay) settle(options.closeValue, 'backdrop'); });
        }
        buttons.forEach((config) => {
            const button = createBtn(config.label ?? 'Close', { variant: config.variant ?? 'ghost', type: 'button', disabled: !!config.disabled });
            button.addEventListener('click', () => settle(config.value, 'action'));
            actions.appendChild(button);
        });
        const focusTarget = modal.querySelector<HTMLElement>('[autofocus], button, input, select, textarea');
        if (focusTarget) requestAnimationFrame(() => focusTarget.focus());
    });
}

/* ── Side drawer ─────────────────────────────────────────────────────────── */

/** Why a drawer closed, including removal by external DOM owners. */
export type DrawerCloseReason = 'escape' | 'button' | 'backdrop' | 'api' | 'detach';

export interface DrawerOptions {
    title?: string;
    side?: 'left' | 'right';
    width?: number;
    content?: unknown;
    trustedHtml?: boolean;
    closeOnEscape?: boolean;
    closeOnBackdrop?: boolean;
    ariaLabel?: string;
    onClose?: (reason: DrawerCloseReason) => void;
}

export type DrawerApi = {
    element: HTMLElement;
    container: HTMLElement;
    close(): void;
    isOpen(): boolean;
};

/** Side drawer factory. */
export function createDrawer(options: DrawerOptions, host: ComponentHost): DrawerApi {
    const side = options.side === 'left' ? 'left' : 'right';
    const overlay = $tag('div', { class: `prestige-drawer-overlay prestige-drawer-overlay-${side}`, role: 'presentation' });
    const drawer = $tag('aside', { class: `prestige-drawer prestige-drawer-${side}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': options.ariaLabel ?? options.title ?? 'Details' });
    const header = $tag('div', { class: 'prestige-drawer-header' });
    const heading = $tag('h3', {}, [$text(options.title ?? 'Details')]);
    const closeButton = createBtn('×', { variant: 'ghost', size: 'sm', type: 'button', className: 'prestige-drawer-close' });
    const body = $tag('div', { class: 'prestige-drawer-body' });
    drawer.style.width = `${String(options.width || 380)}px`;
    header.append(heading, closeButton);
    drawer.append(header, body);
    overlay.appendChild(drawer);
    if (host._mountNode) host._mountNode(overlay);
    else document.body.appendChild(overlay);
    appendContent(body, options.content, host, options.trustedHtml === true);
    let stopWatchingDetach: () => void = () => {};

    const onKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && options.closeOnEscape !== false) close('escape');
        else trapFocusWithin(drawer, event);
    };
    const close = once((reason: DrawerCloseReason) => {
        document.removeEventListener('keydown', onKeydown as EventListener);
        stopWatchingDetach();
        overlay.classList.remove('is-open');
        const finish = (): void => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (typeof options.onClose === 'function') options.onClose(reason);
        };
        if (reason === 'detach') finish();
        else window.setTimeout(finish, 300);
    });
    closeButton.addEventListener('click', () => close('button'));
    if (options.closeOnBackdrop !== false) {
        overlay.addEventListener('click', (event) => { if (event.target === overlay) close('backdrop'); });
    }
    if (host._listen) host._listen(document, 'keydown', onKeydown as EventListener);
    else document.addEventListener('keydown', onKeydown as EventListener);
    stopWatchingDetach = selfCleanupOnDetach(overlay, () => close('detach'));
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    return {
        element: drawer,
        container: body,
        close: () => close('api'),
        isOpen: () => overlay.classList.contains('is-open'),
    };
}

/* ── Registry adapters (parity with Prestige.components) ────────────────── */

defaultRegistry.register('progress', (options) => createProgress(options as ProgressOptions));
defaultRegistry.register('tabs', (options, instance) => createTabs(undefined, { ...(options as TabsOptions), ...(instance ? { instance } : {}) }));
defaultRegistry.register('alert', (options, instance) => createAlert({ ...(options as AlertOptions), ...(instance ? { instance } : {}) }));
defaultRegistry.register('switch', (options) => createSwitch(options as SwitchOptions));
defaultRegistry.register('accordion', (options, instance) => createAccordion({ ...(options as AccordionOptions), ...(instance ? { instance } : {}) }));
defaultRegistry.register('pagination', (options) => createPagination(options as PaginationOptions));
defaultRegistry.register('skeleton', (options) => createSkeleton(options as SkeletonOptions));
defaultRegistry.register('emptyState', (options) => createEmptyState(options as EmptyStateOptions));
defaultRegistry.register('avatar', (options) => createAvatar(options as AvatarOptions));
defaultRegistry.register('breadcrumb', (options) => createBreadcrumb(options as BreadcrumbOptions));
defaultRegistry.register('tooltip', (options) => createTooltip(options as TooltipOptions));
defaultRegistry.register('dropdown', (options, instance) => createDropdown(options as DropdownOptions, instance));
defaultRegistry.register('stepper', (options) => createStepper(options as StepperOptions));
defaultRegistry.register('dataTable', (options, instance) => createDataTable({ ...(options as DataTableOptions<DataRow>), ...(instance ? { instance } : {}) }));
defaultRegistry.register('checkbox', (options) => createCheckbox(options as CheckboxOptions));
defaultRegistry.register('radioGroup', (options) => createRadioGroup(options as RadioGroupOptions));
defaultRegistry.register('select', (options) => createSelect(options as SelectOptions));
defaultRegistry.register('textarea', (options) => createTextarea(options as TextareaOptions));
defaultRegistry.register('inputGroup', (options) => createInputGroup(options as InputGroupOptions));
defaultRegistry.register('segmentedControl', (options) => createSegmentedControl(options as SegmentedControlOptions));
defaultRegistry.register('searchInput', (options) => createSearchInput(options as SearchInputOptions));
defaultRegistry.register('fileInput', (options) => createFileInput(options as FileInputOptions));
defaultRegistry.register('button', (options) => createBtn((options as ButtonOptions & ComponentOptions).label as string ?? '', options as ButtonOptions));
defaultRegistry.register('card', (options) => createCard((options as CardOptions & ComponentOptions).title as string, (options as { body?: Node }).body ?? null, options as CardOptions));
defaultRegistry.register('input', (options) => createInput(options as InputOptions));
defaultRegistry.register('badge', (options) => createBadge((options as { label?: string }).label ?? '', (options as { variant?: BadgeVariant }).variant));
defaultRegistry.register('table', (options) => createTable((options as { headers?: string[] }).headers, (options as { rows?: ReadonlyArray<ReadonlyArray<TableCell>> }).rows));
