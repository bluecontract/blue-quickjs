import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkTsProjectReferences } from './check-ts-project-references.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

test('production workspace imports are covered by TypeScript project references', async () => {
  const result = await checkTsProjectReferences(repoRoot);

  assert.equal(result.checks.referencesComplete, true);
  assert.deepEqual(result.missingReferences, []);
});
