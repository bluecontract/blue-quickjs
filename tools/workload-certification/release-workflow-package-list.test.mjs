import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  PUBLIC_PACKAGE_PROJECTS,
  PUBLIC_PACKAGES,
} from './public-packages.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

test('release workflow package build list matches PUBLIC_PACKAGE_PROJECTS', async () => {
  const workflowText = await readFile(
    path.join(repoRoot, '.github/workflows/release.yml'),
    'utf8',
  );
  const projectLists = extractNxProjectLists(workflowText);

  assert.ok(projectLists.length > 0, 'expected at least one --projects list');
  assert.ok(
    projectLists.some((projects) =>
      sameMembers(projects, PUBLIC_PACKAGE_PROJECTS),
    ),
    'release.yml must contain a public package build list matching PUBLIC_PACKAGES',
  );
});

test('workload certification workflow mentions every public package project', async () => {
  const workflowText = await readFile(
    path.join(repoRoot, '.github/workflows/workload-certification.yml'),
    'utf8',
  );

  for (const project of PUBLIC_PACKAGE_PROJECTS) {
    assert.match(
      workflowText,
      new RegExp(`(^|[,\\s])${escapeRegExp(project)}($|[,\\s])`),
      `${project} is missing from workload-certification.yml`,
    );
  }
});

test('Verdaccio rehearsal derives its package set from PUBLIC_PACKAGES', async () => {
  const scriptText = await readFile(
    path.join(
      repoRoot,
      'tools/workload-certification/run-verdaccio-publish-rehearsal.mjs',
    ),
    'utf8',
  );

  assert.match(scriptText, /PUBLIC_PACKAGES/);
  assert.match(scriptText, /PUBLIC_PACKAGE_PROJECTS/);
  for (const packageName of PUBLIC_PACKAGES) {
    assert.doesNotMatch(
      scriptText,
      new RegExp(`['"]${escapeRegExp(packageName)}['"]`),
      `${packageName} should come from PUBLIC_PACKAGES, not a local literal`,
    );
  }
});

function extractNxProjectLists(workflowText) {
  return [...workflowText.matchAll(/--projects\s+([^\n]+)/g)].map((match) =>
    match[1]
      .trim()
      .split(',')
      .map((project) => project.trim())
      .filter(Boolean),
  );
}

function sameMembers(actual, expected) {
  return (
    actual.length === expected.length &&
    expected.every((project) => actual.includes(project))
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
