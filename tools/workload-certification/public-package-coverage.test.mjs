import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkPublicPackageCoverage } from './check-public-package-coverage.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

test('public package coverage includes every publishable workspace package', async () => {
  const result = await checkPublicPackageCoverage(repoRoot);

  assert.equal(result.checks.noMissingPublishablePackages, true);
  assert.equal(result.checks.noExtraPublicPackages, true);
  assert.equal(result.checks.noDuplicatePublicPackages, true);
  assert.deepEqual(result.missingFromPublicPackages, []);
  assert.match(
    result.configuredPackages.join('\n'),
    /@blue-quickjs\/deterministic-builder/,
  );
});
