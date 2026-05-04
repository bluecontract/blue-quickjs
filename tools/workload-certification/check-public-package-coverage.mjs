#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { PUBLIC_PACKAGES } from './public-packages.mjs';

if (isMain()) {
  const output = await checkPublicPackageCoverage(process.cwd());
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!Object.values(output.checks).every(Boolean)) {
    process.exitCode = 1;
  }
}

export async function checkPublicPackageCoverage(repoRoot) {
  const workspacePackages = await discoverWorkspacePackages(repoRoot);
  const publishablePackages = workspacePackages
    .filter((entry) => !entry.private)
    .map((entry) => entry.name)
    .sort();
  const configuredPackages = [...PUBLIC_PACKAGES].sort();
  const configuredSet = new Set(configuredPackages);
  const publishableSet = new Set(publishablePackages);

  const missingFromPublicPackages = publishablePackages.filter(
    (packageName) => !configuredSet.has(packageName),
  );
  const extraPublicPackages = configuredPackages.filter(
    (packageName) => !publishableSet.has(packageName),
  );
  const duplicatePublicPackages = configuredPackages.filter(
    (packageName, index) => index !== configuredPackages.indexOf(packageName),
  );

  const checks = {
    noMissingPublishablePackages: missingFromPublicPackages.length === 0,
    noExtraPublicPackages: extraPublicPackages.length === 0,
    noDuplicatePublicPackages: duplicatePublicPackages.length === 0,
  };

  return {
    checks,
    publishablePackageCount: publishablePackages.length,
    configuredPackageCount: PUBLIC_PACKAGES.length,
    publishablePackages,
    configuredPackages,
    missingFromPublicPackages,
    extraPublicPackages,
    duplicatePublicPackages,
  };
}

function isMain() {
  if (!process.argv[1]) {
    return false;
  }
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}

async function discoverWorkspacePackages(rootDir) {
  const packages = [];
  for (const scope of ['apps', 'libs', 'tools']) {
    const scopeDir = path.join(rootDir, scope);
    const entries = await readdir(scopeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const packageJsonPath = path.join(scopeDir, entry.name, 'package.json');
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
        if (typeof packageJson.name !== 'string') {
          continue;
        }
        packages.push({
          name: packageJson.name,
          private: Boolean(packageJson.private),
          path: path.relative(rootDir, packageJsonPath),
        });
      } catch {
        // Ignore workspace directories that do not contain package manifests.
      }
    }
  }
  return packages;
}
