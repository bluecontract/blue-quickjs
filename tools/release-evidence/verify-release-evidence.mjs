#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { loadOptionalText, verifyManifestBundle } from './_lib.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const evidenceDir = path.resolve(repoRoot, args.evidenceDir);
const manifestPath = path.resolve(
  evidenceDir,
  args.manifestPath ?? 'release-evidence-manifest.json',
);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const publicKeyPem =
  (await loadOptionalText(args.publicKeyPath ?? '')) ??
  process.env.RELEASE_EVIDENCE_PUBLIC_KEY ??
  null;

const verification = await verifyManifestBundle(manifest, evidenceDir, {
  publicKeyPem,
});

const branchCheck = buildBranchCheck(manifest.branch, args.expectedBranch);
const dateCheck = buildDateCheck(manifest.date, args.expectedDate);

const output = {
  evidenceDir,
  manifestPath: path.relative(repoRoot, manifestPath),
  artifactCount: manifest.artifacts.length,
  verification,
  branchCheck,
  dateCheck,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

if (!verification.ok || !branchCheck.ok || !dateCheck.ok) {
  process.exitCode = 1;
}

function buildBranchCheck(actual, expectedBranchArg) {
  const expectedBranch = expectedBranchArg ?? resolveCurrentBranch(process.cwd());
  return {
    expected: expectedBranch,
    actual,
    ok: actual === expectedBranch,
  };
}

function buildDateCheck(actual, expectedDateArg) {
  const expectedDate = expectedDateArg ?? new Date().toISOString().slice(0, 10);
  return {
    expected: expectedDate,
    actual,
    ok: actual === expectedDate,
  };
}

function resolveCurrentBranch(cwd) {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function parseArgs(argv) {
  const parsed = {
    evidenceDir: 'artifacts/release-evidence',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--evidence-dir') {
      parsed.evidenceDir = argv[index + 1] ?? parsed.evidenceDir;
      index += 1;
      continue;
    }
    if (arg === '--manifest-path') {
      parsed.manifestPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--public-key-path') {
      parsed.publicKeyPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--expected-branch') {
      parsed.expectedBranch = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--expected-date') {
      parsed.expectedDate = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}
