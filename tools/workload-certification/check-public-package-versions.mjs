#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PUBLIC_PACKAGES } from './public-packages.mjs';

const repoRoot = process.cwd();
const packageInfos = [];

for (const pkg of PUBLIC_PACKAGES) {
  const packageJsonPath = await resolveWorkspacePackageJsonPath(repoRoot, pkg);
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  packageInfos.push({
    name: packageJson.name,
    version: packageJson.version,
    private: Boolean(packageJson.private),
    path: path.relative(repoRoot, packageJsonPath),
  });
}

const versionSet = new Set(packageInfos.map((entry) => entry.version));
const privatePackages = packageInfos.filter((entry) => entry.private);
const checks = {
  alignedVersion: versionSet.size === 1,
  noPrivatePackages: privatePackages.length === 0,
};

const output = {
  packageCount: packageInfos.length,
  targetVersion: versionSet.size === 1 ? [...versionSet][0] : null,
  checks,
  packages: packageInfos,
  privatePackages,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!checks.alignedVersion || !checks.noPrivatePackages) {
  process.exitCode = 1;
}

async function resolveWorkspacePackageJsonPath(root, packageName) {
  const shortName = packageName.replace('@blue-quickjs/', '');
  const candidatePaths = [
    path.join(root, 'libs', shortName, 'package.json'),
    path.join(root, 'tools', shortName, 'package.json'),
  ];
  return findExistingPath(candidatePaths, packageName);
}

async function findExistingPath(candidatePaths, packageName) {
  for (const candidate of candidatePaths) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(`unable to resolve package.json path for ${packageName}`);
}
