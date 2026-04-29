import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLUE_JS_ENVIRONMENT_CONTRACT_TYPE,
  BLUE_JS_LIBRARY_SOURCE_TYPE,
  BLUE_JS_STEP_TYPE,
} from './types.js';
import { buildLibraryArtifact } from './build-library-artifact.js';
import { buildStepArtifact } from './build-step-artifact.js';
import { createImportLock } from './import-lock.js';
import { importNpmLibrary } from './import-npm-library.js';
import { mergeJavaScriptEnvironmentContracts } from './contract-merge.js';

const SAMPLE_HASH =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('@blue-quickjs/blue-documents', () => {
  it('builds a Blue-authored library artifact and import lock', async () => {
    const artifact = await buildLibraryArtifact(
      {
        type: BLUE_JS_LIBRARY_SOURCE_TYPE,
        package: {
          registry: 'blue',
          name: 'math-lib',
          version: '1.0.0',
        },
        executionProfile: 'baseline-v1',
        entry: './index.js',
        modules: {
          './index.js': 'export function plusOne(n) { return n + 1; }',
        },
      },
      {
        builderOptions: {
          dependencyIntegrity: SAMPLE_HASH,
        },
      },
    );

    expect(artifact.type).toBe('BlueQuickjs/JavaScript Library Artifact');
    expect(artifact.package.name).toBe('math-lib');
    expect(artifact.artifact.modulePack.graphHash).toMatch(/^[0-9a-f]{64}$/);

    const lock = createImportLock({
      specifier: 'math-lib',
      libraryDocumentId: 'doc-math-lib',
      artifact,
    });
    expect(lock.requiredBuild.modulePackGraphHash).toBe(
      artifact.build.modulePackGraphHash,
    );
  });

  it('merges compatible contracts and rejects conflicting locks', async () => {
    const artifact = await buildLibraryArtifact(
      {
        type: BLUE_JS_LIBRARY_SOURCE_TYPE,
        package: {
          registry: 'blue',
          name: 'math-lib',
          version: '1.0.0',
        },
        executionProfile: 'baseline-v1',
        entry: './index.js',
        modules: {
          './index.js': 'export default 1;',
        },
      },
      {
        builderOptions: {
          dependencyIntegrity: SAMPLE_HASH,
        },
      },
    );
    const lock = createImportLock({
      specifier: 'math-lib',
      libraryDocumentId: 'doc-math-lib',
      artifact,
    });

    const merged = mergeJavaScriptEnvironmentContracts([
      {
        type: BLUE_JS_ENVIRONMENT_CONTRACT_TYPE,
        executionProfile: 'baseline-v1',
        abi: { id: 'Host.v1', version: 1 },
        imports: { 'math-lib': lock },
      },
      {
        type: BLUE_JS_ENVIRONMENT_CONTRACT_TYPE,
        executionProfile: 'baseline-v1',
        abi: { id: 'Host.v1', version: 1 },
        imports: { 'math-lib': lock },
      },
    ]);

    expect(Object.keys(merged.imports)).toEqual(['math-lib']);
    expect(() =>
      mergeJavaScriptEnvironmentContracts([
        {
          type: BLUE_JS_ENVIRONMENT_CONTRACT_TYPE,
          executionProfile: 'baseline-v1',
          abi: { id: 'Host.v1', version: 1 },
          imports: { 'math-lib': lock },
        },
        {
          type: BLUE_JS_ENVIRONMENT_CONTRACT_TYPE,
          executionProfile: 'compat-general-v1',
          abi: { id: 'Host.v1', version: 1 },
          imports: { 'math-lib': lock },
        },
      ]),
    ).toThrow(/executionProfile mismatch/);
  });

  it('builds a step artifact from a locked Blue-authored library', async () => {
    const artifact = await buildLibraryArtifact(
      {
        type: BLUE_JS_LIBRARY_SOURCE_TYPE,
        package: {
          registry: 'blue',
          name: 'math-lib',
          version: '1.0.0',
        },
        executionProfile: 'baseline-v1',
        entry: './index.js',
        modules: {
          './index.js': 'export function plusOne(n) { return n + 1; }',
        },
      },
      {
        builderOptions: {
          dependencyIntegrity: SAMPLE_HASH,
        },
      },
    );
    const lock = createImportLock({
      specifier: 'math-lib',
      libraryDocumentId: 'doc-math-lib',
      artifact,
    });

    const built = await buildStepArtifact(
      {
        type: BLUE_JS_STEP_TYPE,
        useContracts: ['jsBase'],
        entry:
          "import { plusOne } from 'math-lib'; export default plusOne(41);",
      },
      {
        contracts: {
          jsBase: {
            type: BLUE_JS_ENVIRONMENT_CONTRACT_TYPE,
            executionProfile: 'baseline-v1',
            abi: { id: 'Host.v1', version: 1 },
            imports: { 'math-lib': lock },
          },
        },
      },
      {
        documents: {
          'doc-math-lib': artifact,
        },
      },
    );

    expect(built.programArtifact.sourceKind).toBe('module-pack');
    expect(built.importedLibraries).toHaveLength(1);
  });

  it('imports an npm-origin library from a local package directory', async () => {
    const packageDir = await mkdtemp(
      path.join(os.tmpdir(), 'blue-npm-fixture-'),
    );
    await writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify({
        name: 'fixture-lib',
        version: '1.0.0',
        type: 'module',
        exports: './index.js',
      }),
      'utf8',
    );
    await writeFile(
      path.join(packageDir, 'index.js'),
      'export default 42;',
      'utf8',
    );

    const artifact = await importNpmLibrary(
      {
        type: 'BlueQuickjs/Npm Library Source',
        npm: {
          registryUrl: 'https://registry.npmjs.org',
          name: 'fixture-lib',
          version: '1.0.0',
          packageDir,
        },
        executionProfile: 'baseline-v1',
        entry: 'auto',
      },
      {
        packageDir,
      },
    );

    expect(artifact.package.registry).toBe('npm');
    expect(artifact.origin?.packageName).toBe('fixture-lib');
    expect(artifact.artifact.modulePack.modules.length).toBeGreaterThan(0);
  });
});
