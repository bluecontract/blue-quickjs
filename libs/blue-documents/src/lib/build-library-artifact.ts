import {
  buildDeterministicModulePack,
  type BuildDeterministicModulePackOptions,
} from '@blue-quickjs/deterministic-builder';
import {
  BLUE_JS_LIBRARY_ARTIFACT_TYPE,
  type JavaScriptLibraryArtifactDocument,
} from './types.js';
import { computeLibrarySourceIntegrity } from './source-integrity.js';
import { validateJavaScriptLibrarySource } from './validators.js';
import { createTempSourceTree, writeModuleMap } from './temp-source-tree.js';

export interface BuildLibraryArtifactOptions {
  readonly keepTempDir?: boolean;
  readonly builderOptions?: Partial<
    Pick<
      BuildDeterministicModulePackOptions,
      'builderVersion' | 'dependencyIntegrity' | 'rejectIncompatible'
    >
  >;
}

export async function buildLibraryArtifact(
  value: unknown,
  options: BuildLibraryArtifactOptions = {},
): Promise<JavaScriptLibraryArtifactDocument> {
  const source = validateJavaScriptLibrarySource(value);
  const sourceIntegritySha256 = computeLibrarySourceIntegrity(source);
  const tree = await createTempSourceTree('blue-js-library-');
  try {
    await writeModuleMap(tree.dir, source.modules);
    const built = await buildDeterministicModulePack({
      absWorkingDir: tree.dir,
      entryPath: source.entry,
      profile: source.executionProfile,
      emitProgramArtifact: false,
      rejectIncompatible: options.builderOptions?.rejectIncompatible ?? true,
      ...(options.builderOptions?.builderVersion
        ? { builderVersion: options.builderOptions.builderVersion }
        : {}),
      ...(options.builderOptions?.dependencyIntegrity
        ? { dependencyIntegrity: options.builderOptions.dependencyIntegrity }
        : {}),
    });

    return {
      type: BLUE_JS_LIBRARY_ARTIFACT_TYPE,
      package: {
        registry: 'blue',
        name: source.package.name,
        version: source.package.version,
        sourceIntegritySha256,
      },
      processing: {
        runtime: 'BlueQuickjs',
        sourceKind: 'module-pack',
        modulePackVersion: 1,
        programArtifactVersion: 2,
        executionProfile: source.executionProfile,
      },
      build: {
        builderVersion: built.modulePack.builderVersion,
        dependencyIntegritySha256: built.modulePack.dependencyIntegrity,
        modulePackGraphHash: built.modulePack.graphHash,
      },
      artifact: {
        modulePack: built.modulePack,
      },
    };
  } finally {
    if (!options.keepTempDir) {
      await tree.cleanup();
    }
  }
}
