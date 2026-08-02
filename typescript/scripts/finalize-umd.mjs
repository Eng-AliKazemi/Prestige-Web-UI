/**
 * Post-build step: finalize the UMD bundle so it is a drop-in replacement for
 * the vanilla `dist/prestige.js`.
 *
 * 1. Expose the `Prestige` class as the global (not a namespace object), with
 *    every named export attached (`Prestige.create(...)`, `Prestige.createBtn(...)`,
 *    `Prestige.DisposalStack`, ...).
 * 2. Restore the vanilla `window.*` helper globals (`createBtn`, `createCard`,
 *    `$tag`, `renderIcons`, `DisposalStack`, ...) so existing pages keep working
 *    unchanged.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('../dist/prestige.umd.cjs');
const marker = '__prestigeFinalize';
let code = readFileSync(path, 'utf8');

if (code.includes(marker)) {
    console.log('finalize-umd: already applied');
} else {
    code += `
// Prestige UMD: expose the Prestige class as the global with all named exports
// attached, then restore the vanilla window.* helper globals.
(function () {
  if (typeof globalThis.Prestige !== 'object' || globalThis.Prestige === null || !globalThis.Prestige.default) return;
  var __prestigeNamespace = globalThis.Prestige;
  var __prestige = __prestigeNamespace.default;
  Object.assign(__prestige, __prestigeNamespace);
  globalThis.Prestige = __prestige;

  var __helperNames = [
    '$id', '$tag', '$text', 'escapeHtml', 'sanitizeHtml', 'isSafeAppId', 'assertSafeAppId',
    'renderIcons', 'DisposalStack', 'Owned', 'PrestigeStore',
    'createBtn', 'createCard', 'createField', 'createInput', 'createStatCard', 'createBadge', 'createTable',
    'createTabs', 'createProgressBar', 'createAlert', 'createSwitch', 'createAccordion', 'createPagination',
    'createSkeleton', 'createEmptyState', 'createAvatar', 'createBreadcrumb', 'createTooltip', 'createDropdown',
    'createStepper', 'createDataTable', 'createCheckbox', 'createRadioGroup', 'createSelect', 'createTextarea',
    'createInputGroup', 'createSegmentedControl', 'createSearchInput', 'createFileInput', 'createToast',
    'createModal', 'createDrawer', 'web3TransactionGuard'
  ];
  for (var __i = 0; __i < __helperNames.length; __i++) {
    var __name = __helperNames[__i];
    if (typeof __prestige[__name] !== 'undefined') globalThis[__name] = __prestige[__name];
  }
  globalThis.$icon = __prestige.createIcon;
  if (typeof __prestige.ICONS === 'object' && __prestige.ICONS !== null) {
    globalThis.PrestigeIcons = Object.freeze(Object.keys(__prestige.ICONS));
  }
  var __marker = '${marker}';
})();
`;
    writeFileSync(path, code, 'utf8');
}

console.log('finalized', path);
