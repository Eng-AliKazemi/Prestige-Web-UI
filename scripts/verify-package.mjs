/** Verify the published package from an isolated consumer's perspective. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'prestige-package-'));
const allowedFiles = new Set([
  'LICENSE',
  'README.md',
  'THIRD_PARTY_NOTICES',
  'package.json',
]);
const allowedPrefixes = ['css/', 'dist/', 'typescript/src/'];

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function collectTargets(value, label, targets) {
  if (typeof value === 'string') {
    targets.push([label, value, true]);
    return;
  }
  if (value === null) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectTargets(entry, `${label}[${index}]`, targets));
    return;
  }
  assert.equal(typeof value, 'object', `${label} has an invalid package target`);
  for (const [key, entry] of Object.entries(value)) {
    collectTargets(entry, `${label}.${key}`, targets);
  }
}

function targetPattern(target) {
  const packagePath = target.startsWith('./') ? target.slice(2) : target;
  const escaped = packagePath
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${escaped.join('.*')}$`);
}

try {
  const packOutput = run(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', temporaryRoot, '.'],
    root,
  );
  const [packResult] = JSON.parse(packOutput);
  assert(packResult?.filename, 'npm pack did not report a tarball');
  assert(Array.isArray(packResult.files), 'npm pack did not report package contents');

  const packageFiles = new Set(packResult.files.map(({ path }) => path));
  for (const path of packageFiles) {
    assert(!path.startsWith('/') && !path.split('/').includes('..'), `unsafe package path: ${path}`);
    assert(
      allowedFiles.has(path) || allowedPrefixes.some((prefix) => path.startsWith(prefix)),
      `unexpected file in package: ${path}`,
    );
  }
  for (const path of allowedFiles) {
    assert(packageFiles.has(path), `required package file is missing: ${path}`);
  }

  const resolvedTemporaryRoot = realpathSync(temporaryRoot);
  const tarball = realpathSync(join(temporaryRoot, packResult.filename));
  assert.equal(relative(resolvedTemporaryRoot, tarball).startsWith(`..${sep}`), false, 'tarball escaped temporary directory');

  writeFileSync(
    join(temporaryRoot, 'package.json'),
    `${JSON.stringify({ private: true }, null, 2)}\n`,
  );
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball], temporaryRoot);

  const installedRoot = join(temporaryRoot, 'node_modules', 'prestige-ui');
  const manifest = JSON.parse(readFileSync(join(installedRoot, 'package.json'), 'utf8'));
  const targets = [];
  collectTargets(manifest.exports, 'exports', targets);
  for (const field of ['main', 'module', 'types', 'style']) {
    assert.equal(typeof manifest[field], 'string', `package.json is missing ${field}`);
    targets.push([field, manifest[field], false]);
  }
  for (const [label, target, isExport] of targets) {
    assert(!target.startsWith('/') && !target.split('/').includes('..'), `${label} has an unsafe target: ${target}`);
    assert(!isExport || target.startsWith('./'), `${label} must be a package-relative target: ${target}`);
    const pattern = targetPattern(target);
    assert(
      [...packageFiles].some((path) => pattern.test(path)),
      `${label} points outside the packed files: ${target}`,
    );
  }
  assert(readFileSync(join(installedRoot, 'THIRD_PARTY_NOTICES'), 'utf8').trim(), 'THIRD_PARTY_NOTICES is empty');

  writeFileSync(
    join(temporaryRoot, 'esm-smoke.mjs'),
    "import Prestige, { Prestige as NamedPrestige, createBtn } from 'prestige-ui';\n" +
      "if (typeof Prestige !== 'function' || Prestige !== NamedPrestige || typeof createBtn !== 'function') {\n" +
      "  throw new Error('ESM package exports are invalid');\n" +
      '}\n',
  );
  writeFileSync(
    join(temporaryRoot, 'commonjs-smoke.cjs'),
    "const prestige = require('prestige-ui');\n" +
      "if (typeof prestige.Prestige !== 'function' || typeof prestige.createBtn !== 'function') {\n" +
      "  throw new Error('CommonJS package exports are invalid');\n" +
      '}\n',
  );
  run('node', ['esm-smoke.mjs'], temporaryRoot);
  run('node', ['commonjs-smoke.cjs'], temporaryRoot);

  console.log(`Package verification passed (${packageFiles.size} files; ESM and CommonJS consumers).`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
