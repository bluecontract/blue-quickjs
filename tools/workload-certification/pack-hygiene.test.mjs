import assert from 'node:assert/strict';
import test from 'node:test';
import { findPackedPackageHygieneViolations } from './pack-hygiene.mjs';

test('packed package hygiene rejects test artifacts and vitest references', () => {
  const violations = findPackedPackageHygieneViolations([
    { path: 'package/dist/test/helper.js', text: 'export {};\n' },
    { path: 'package/dist/lib/foo.spec.d.ts', text: 'export {};\n' },
    {
      path: 'package/dist/index.js',
      text: "import { vi } from 'vitest';\nexport { vi };\n",
    },
  ]);

  assert.deepEqual(violations, [
    'dist/test/helper.js is under dist/test',
    'dist/lib/foo.spec.d.ts is a test/spec artifact',
    'dist/index.js references vitest',
  ]);
});

test('packed package hygiene allows production dist entries', () => {
  const violations = findPackedPackageHygieneViolations([
    { path: 'package/dist/index.js', text: "export * from './lib/foo.js';\n" },
    { path: 'package/dist/lib/foo.d.ts', text: 'export declare const foo = 1;\n' },
    { path: 'package/README.md', text: 'Run tests with vitest.\n' },
  ]);

  assert.deepEqual(violations, []);
});
