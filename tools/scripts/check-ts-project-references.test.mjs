import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
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

test('src/test helpers do not force production TypeScript project references', async () => {
  const fixtureRoot = await createProjectReferenceFixture({
    consumerFiles: {
      'src/test/helper.ts':
        "import { value } from '@blue-quickjs/dependency';\nexport { value };\n",
    },
  });

  try {
    const result = await checkTsProjectReferences(fixtureRoot);

    assert.equal(result.checks.referencesComplete, true);
    assert.deepEqual(result.missingReferences, []);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('production files still require TypeScript project references', async () => {
  const fixtureRoot = await createProjectReferenceFixture({
    consumerFiles: {
      'src/lib/production-file.ts':
        "import { value } from '@blue-quickjs/dependency';\nexport { value };\n",
    },
  });

  try {
    const result = await checkTsProjectReferences(fixtureRoot);

    assert.equal(result.checks.referencesComplete, false);
    assert.equal(result.missingReferences.length, 1);
    assert.equal(result.missingReferences[0].project, 'consumer');
    assert.equal(result.missingReferences[0].import, '@blue-quickjs/dependency');
    assert.deepEqual(result.missingReferences[0].importedBy, [
      'libs/consumer/src/lib/production-file.ts',
    ]);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

async function createProjectReferenceFixture({ consumerFiles }) {
  const fixtureRoot = await mkdtemp(
    path.join(os.tmpdir(), 'blue-quickjs-project-refs-'),
  );
  const consumerRoot = path.join(fixtureRoot, 'libs/consumer');
  const dependencyRoot = path.join(fixtureRoot, 'libs/dependency');

  await writeJson(path.join(consumerRoot, 'package.json'), {
    name: '@blue-quickjs/consumer',
    nx: { name: 'consumer' },
  });
  await writeJson(path.join(consumerRoot, 'tsconfig.lib.json'), {
    references: [],
  });
  await writeJson(path.join(dependencyRoot, 'package.json'), {
    name: '@blue-quickjs/dependency',
    nx: { name: 'dependency' },
  });
  await writeJson(path.join(dependencyRoot, 'tsconfig.lib.json'), {
    references: [],
  });
  await writeText(
    path.join(dependencyRoot, 'src/index.ts'),
    'export const value = 1;\n',
  );

  for (const [relativePath, content] of Object.entries(consumerFiles)) {
    await writeText(path.join(consumerRoot, relativePath), content);
  }

  return fixtureRoot;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}
