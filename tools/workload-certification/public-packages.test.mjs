import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PUBLIC_PACKAGES } from './public-packages.mjs';
import { checkPublicPackageCoverage } from './check-public-package-coverage.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

test('PUBLIC_PACKAGES includes public release-train packages', () => {
  assert.match(
    PUBLIC_PACKAGES.join('\n'),
    /@blue-quickjs\/deterministic-builder/,
  );
  assert.equal(new Set(PUBLIC_PACKAGES).size, PUBLIC_PACKAGES.length);
});

test('every configured public package resolves to a non-private workspace manifest', async () => {
  const coverage = await checkPublicPackageCoverage(repoRoot);
  const expectedVersion = await readPackageVersion(
    path.join(repoRoot, 'libs/abi-manifest/package.json'),
  );

  for (const packageName of PUBLIC_PACKAGES) {
    const manifestPath = path.join(
      repoRoot,
      'libs',
      packageName.replace('@blue-quickjs/', ''),
      'package.json',
    );
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

    assert.equal(manifest.name, packageName);
    assert.notEqual(manifest.private, true, `${packageName} must be public`);
    assert.equal(
      manifest.version,
      expectedVersion,
      `${packageName} must match the release train version`,
    );
  }

  assert.deepEqual(coverage.extraPublicPackages, []);
});

test('PUBLIC_PACKAGES covers every discovered publishable workspace package', async () => {
  const coverage = await checkPublicPackageCoverage(repoRoot);

  assert.equal(coverage.checks.noMissingPublishablePackages, true);
  assert.deepEqual(coverage.missingFromPublicPackages, []);
});

async function readPackageVersion(packageJsonPath) {
  const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  return manifest.version;
}
