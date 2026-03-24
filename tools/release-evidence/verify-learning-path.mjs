#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();

const pages = [
  'docs/learn/00-what-is-bluequickjs.md',
  'docs/learn/01-install-and-run-your-first-script.md',
  'docs/learn/02-understand-the-program-artifact.md',
  'docs/learn/03-module-packs-and-imports.md',
  'docs/learn/04-promises-async-and-microtasks.md',
  'docs/learn/05-binary-and-host-v2.md',
  'docs/learn/06-gas-oog-and-max-gas-policies.md',
  'docs/learn/07-verify-release-evidence.md',
  'docs/learn/08-build-a-real-example.md',
  'docs/learn/09-production-embedder-checklist.md',
];

const requiredSections = [
  '## Prerequisites',
  '## Commands',
  '## Expected output',
  '## What you learned',
  '## Continue',
  '## Troubleshooting',
];

const problems = [];

for (let index = 0; index < pages.length; index += 1) {
  const relativePath = pages[index];
  const contents = await readFile(path.join(repoRoot, relativePath), 'utf8');

  for (const section of requiredSections) {
    if (!contents.includes(section)) {
      problems.push(`${relativePath}: missing required section "${section}"`);
    }
  }

  if (index < pages.length - 1) {
    const nextPagePath = pages[index + 1];
    const nextPageName = path.basename(nextPagePath);
    if (!contents.includes(nextPageName)) {
      problems.push(
        `${relativePath}: continue section should reference ${nextPageName}`,
      );
    }
  }
}

process.stdout.write(
  `${JSON.stringify(
    {
      checkedPageCount: pages.length,
      requiredSectionCount: requiredSections.length,
      problemCount: problems.length,
      problems,
    },
    null,
    2,
  )}\n`,
);

if (problems.length > 0) {
  process.exitCode = 1;
}
