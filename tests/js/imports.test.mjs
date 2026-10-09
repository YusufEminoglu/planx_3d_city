// Every relative import in the viewer (static, dynamic import() and worker
// URLs) must point at a file that exists. Dynamic imports and worker URLs
// resolve against the importing module, so moving code between folders can
// break them without any syntax or lint error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/src');

function viewerModules(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'assets' ? [] : viewerModules(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

test('relative imports and worker URLs resolve', () => {
  const missing = [];
  const patterns = [
    /^\s*import\s[^;]*?from\s+'(\.[^']+)'/gm,
    /\bimport\(\s*'(\.[^']+)'\s*\)/g,
    /new URL\(\s*'(\.[^']+)'\s*,\s*import\.meta\.url\s*\)/g
  ];
  for (const file of viewerModules(srcRoot)) {
    const code = fs.readFileSync(file, 'utf8');
    for (const re of patterns) {
      for (const m of code.matchAll(re)) {
        const target = path.resolve(path.dirname(file), m[1]);
        if (!fs.existsSync(target)) missing.push(`${path.relative(srcRoot, file)} -> ${m[1]}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
