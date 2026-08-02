import { type ComponentHost, type ComponentOptions } from './ComponentRegistry.js';
export interface ButtonOptions {
    variant?: 'primary' | 'success' | 'danger' | 'ghost';
    size?: 'sm';
    className?: string;
    onclick?: (event: MouseEvent) => void;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
}
/** Button factory. */
export declare function createBtn(text: string, opts?: ButtonOptions): HTMLButtonElement;
export interface CardOptions {
    className?: string;
}
/** Glass card with optional title header and body. */
export declare function createCard(title: string, bodyEl: Node | null, opts?: CardOptions): HTMLElement;
/** Labeled form field wrapping an input. */
export declare function createField(labelText: string, inputEl: HTMLElement, helpText?: string): HTMLElement;
export interface InputOptions {
    placeholder?: string;
    value?: string;
    type?: string;
    required?: boolean;
    rows?: number;
    textarea?: boolean;
}
/** Input / textarea factory. */
export declare function createInput(opts?: InputOptions): HTMLInputElement | HTMLTextAreaElement;
/** Stat card showing a big value and a label. */
export declare function createStatCard(value: string | number, label: string): HTMLElement;
export type BadgeVariant = 'info' | 'success' | 'warning' | 'danger' | 'dark';
/** Badge factory. */
export declare function createBadge(text: string, variant?: BadgeVariant): HTMLSpanElement;
export type TableCell = Node | string | number;
/** Plain table factory. */
export declare function createTable(headers?: string[], rows?: ReadonlyArray<ReadonlyArray<TableCell>>): HTMLTableElement;
export interface ProgressOptions extends ComponentOptions {
    value?: number | string;
    max?: number | string;
    label?: string;
}
export type ProgressBar = HTMLDivElement & {
    setValue(value: number | string): number;
    getValue(): number;
};
/** Progress bar factory. */
export declare function createProgress(options?: ProgressOptions): ProgressBar;
/** Backwards-compatible (value, max, options) progress factory. */
export declare function createProgressBar(value?: number, max?: number, options?: ProgressOptions): ProgressBar;
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
/** Tabs factory. */
export declare function createTabs(tabs?: TabItem[], options?: TabsOptions): Tabs;
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
export declare function createAlert(options?: AlertOptions): HTMLElement;
export interface SwitchOptions extends ComponentOptions {
    checked?: boolean;
    label?: string;
    onChange?: (checked: boolean, control: HTMLButtonElement) => void;
}
export type SwitchControl = HTMLButtonElement & {
    setChecked(next: boolean): boolean;
    isChecked(): boolean;
};
/** Toggle switch factory. */
export declare function createSwitch(options?: SwitchOptions): SwitchControl;
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
/** Accordion factory. */
export declare function createAccordion(options?: AccordionOptions): Accordion;
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
/** Pagination factory. */
export declare function createPagination(options?: PaginationOptions): Pagination;
export interface SkeletonOptions extends ComponentOptions {
    count?: number;
    widths?: string[];
    width?: string;
    height?: string;
    label?: string;
}
/** Skeleton loader factory. */
export declare function createSkeleton(options?: SkeletonOptions): HTMLElement;
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
export declare function createEmptyState(options?: EmptyStateOptions): HTMLElement;
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
/** Avatar factory (initials or image). */
export declare function createAvatar(options?: AvatarOptions): HTMLElement;
export interface BreadcrumbItem {
    label?: string;
    href?: string;
}
export interface BreadcrumbOptions extends ComponentOptions {
    items?: BreadcrumbItem[];
    ariaLabel?: string;
}
/** Breadcrumb factory. */
export declare function createBreadcrumb(options?: BreadcrumbOptions): HTMLElement;
export interface TooltipOptions extends ComponentOptions {
    trigger?: Element;
    message?: string;
    id?: string;
}
/** Tooltip factory wrapping a trigger node. */
export declare function createTooltip(options?: TooltipOptions): HTMLElement;
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
/** Dropdown menu factory. */
export declare function createDropdown(options?: DropdownOptions, instance?: ComponentHost): Dropdown;
export interface StepperOptions extends ComponentOptions {
    steps?: Array<string | {
        label?: string;
    }>;
    active?: number;
    onChange?: (active: number, root: HTMLElement) => void;
}
export type Stepper = HTMLOListElement & {
    setActive(index: number): number;
    getActive(): number;
};
/** Stepper factory. */
export declare function createStepper(options?: StepperOptions): Stepper;
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
/** Sortable data table factory (type-safe columns/rows). */
export declare function createDataTable<T extends object>(options?: DataTableOptions<T>): DataTable<T>;
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
/** Checkbox factory. */
export declare function createCheckbox(options?: CheckboxOptions): CheckboxControl;
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
/** Radio group factory. */
export declare function createRadioGroup(options?: RadioGroupOptions): RadioGroup;
export type SelectItem = string | {
    value?: string | number;
    label?: string;
    disabled?: boolean;
};
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
/** Select dropdown factory. */
export declare function createSelect(options?: SelectOptions): SelectControl;
export interface TextareaOptions extends InputOptions, ComponentOptions {
    onChange?: (value: string, textarea: HTMLTextAreaElement) => void;
}
export type TextareaControl = HTMLTextAreaElement & {
    setValue(value: string): string;
    getValue(): string;
};
/** Textarea factory. */
export declare function createTextarea(options?: TextareaOptions): TextareaControl;
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
/** Input group (prefix / input / suffix) factory. */
export declare function createInputGroup(options?: InputGroupOptions): InputGroup;
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
/** Segmented control factory. */
export declare function createSegmentedControl(options?: SegmentedControlOptions): SegmentedControl;
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
/** Search input factory. */
export declare function createSearchInput(options?: SearchInputOptions): SearchInput;
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
/** File input factory. */
export declare function createFileInput(options?: FileInputOptions): FileInput;
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
export declare function createToast(options: ToastOptions, host: ComponentHost): ToastApi;
/** Why a custom modal completed, including removal by external DOM owners. */
export type ModalCloseReason = 'escape' | 'backdrop' | 'action' | 'detach';
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
export declare function createModal(options: ModalOptions, host: ComponentHost): Promise<unknown>;
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
export declare function createDrawer(options: DrawerOptions, host: ComponentHost): DrawerApi;
//# sourceMappingURL=Components.d.ts.map