/**
 * Smoke test: load the built UMD bundle in a simulated browser (happy-dom)
 * and exercise the exact API surface the examples use — the drop-in window.*
 * globals, Prestige class, dialogs, context menu, toast, store, and windows.
 */
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../../dist/prestige.umd.cjs', import.meta.url), 'utf8');
const window = new Window();
vm.createContext(window);
vm.runInContext(code, window);

const promise = vm.runInContext(`
(async function () {
  const out = {};
  const P = globalThis.Prestige;

  // Global surface (vanilla drop-in)
  out.isClass = typeof P === 'function';
  out.create = typeof P.create === 'function';
  out.globals = {
    createBtn: typeof globalThis.createBtn,
    createCard: typeof globalThis.createCard,
    createField: typeof globalThis.createField,
    createInput: typeof globalThis.createInput,
    createStatCard: typeof globalThis.createStatCard,
    createBadge: typeof globalThis.createBadge,
    createTable: typeof globalThis.createTable,
    createDataTable: typeof globalThis.createDataTable,
    createTabs: typeof globalThis.createTabs,
    createProgressBar: typeof globalThis.createProgressBar,
    createAlert: typeof globalThis.createAlert,
    createSwitch: typeof globalThis.createSwitch,
    createAccordion: typeof globalThis.createAccordion,
    createSegmentedControl: typeof globalThis.createSegmentedControl,
    createSearchInput: typeof globalThis.createSearchInput,
    '$tag': typeof globalThis.$tag,
    '$text': typeof globalThis.$text,
    '$icon': typeof globalThis.$icon,
    renderIcons: typeof globalThis.renderIcons,
    DisposalStack: typeof globalThis.DisposalStack,
    Owned: typeof globalThis.Owned,
    PrestigeStore: typeof globalThis.PrestigeStore,
    sanitizeHtml: typeof globalThis.sanitizeHtml,
  };
  out.iconCount = Array.isArray(globalThis.PrestigeIcons) ? globalThis.PrestigeIcons.length : -1;

  // Example-like flow
  const canvas = document.createElement('div');
  canvas.id = 'desktop-canvas';
  document.body.appendChild(canvas);

  const os = new P({ animations: false, dock: false, topdock: false, search: false, toastCenter: true });
  os.init();

  os.registerApp('overview', {
    title: 'Overview',
    icon: 'layout-dashboard',
    content: function () {
      const main = globalThis.$tag('div', { class: 'window-content-main' });
      main.appendChild(globalThis.createCard('Card Title', globalThis.createBtn('Action', { variant: 'primary' })));
      return main;
    },
  });
  const win = os.openWindow('overview', 'layout-dashboard', 'Overview');
  out.window = {
    frame: !!win && win.classList.contains('window'),
    content: !!win.querySelector('.window-content-main'),
    card: !!win.querySelector('.glass-card'),
    disposal: !!win._disposal,
  };

  // Dialog (promise + structural overlay)
  const confirmed = os.dialogConfirm({ message: 'Proceed?' });
  document.querySelector('.prestige-dialog-btn-primary').click();
  out.dialog = await confirmed;

  // Context menu
  os.showContextMenu({ x: 20, y: 20, items: [{ label: 'Open' }, { sep: true }, { label: 'Delete', disabled: true }] });
  out.ctxMenu = !!document.querySelector('.ctx-menu');
  os.hideContextMenu();
  out.ctxMenuGone = !document.querySelector('.ctx-menu');

  // Toast
  os.toast('Welcome', 'success');
  out.toast = !!document.querySelector('.prestige-toast');

  // Store
  const api = os.store.createStore('t', { n: 1 });
  api.n = 2;
  out.store = api.n === 2;

  // Window state + close
  os.closeWindow(win);
  out.closed = document.querySelectorAll('.window').length === 0 && os.getState().length === 0;

  return out;
})()
`, window);

const out = await promise;
const checks = [
  ['UMD global is the Prestige class', out.isClass],
  ['Prestige.create static present', out.create],
  ['all vanilla window.* globals present', Object.values(out.globals).every((t) => t === 'function')],
  ['PrestigeIcons is a frozen icon array', out.iconCount > 0],
  ['window frame + content + disposal', out.window.frame && out.window.content && out.window.card && out.window.disposal],
  ['dialogConfirm resolves true', out.dialog === true],
  ['context menu shows and hides', out.ctxMenu && out.ctxMenuGone],
  ['toast renders', out.toast],
  ['store works', out.store],
  ['closeWindow cleans up', out.closed],
];
let ok = true;
for (const [label, pass] of checks) {
    console.log(pass ? 'PASS' : 'FAIL', '-', label);
    if (!pass) ok = false;
}
if (!ok) {
    console.error(JSON.stringify(out, null, 2));
    process.exit(1);
}
console.log('SMOKE TEST PASSED');
