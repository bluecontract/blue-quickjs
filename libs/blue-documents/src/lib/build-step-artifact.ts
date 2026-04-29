import { HOST_V1_HASH, HOST_V2_HASH } from '@blue-quickjs/abi-manifest';
import { buildDeterministicModulePack } from '@blue-quickjs/deterministic-builder';
import type { ProgramArtifactV2 } from '@blue-quickjs/deterministic-builder';
import { mergeJavaScriptEnvironmentContracts } from './contract-merge.js';
import {
  MapDocumentResolver,
  type DocumentResolver,
  resolveAndVerifyImportLocks,
} from './document-resolver.js';
import { type BuildStepArtifactResult, type ScopeDocument } from './types.js';
import { validateJavaScriptStep } from './validators.js';
import {
  createTempSourceTree,
  materializeModulePackAsPackage,
  parsePackageImportSpecifier,
  writeModuleMap,
  writeSourceModule,
} from './temp-source-tree.js';

export interface BuildStepArtifactOptions {
  readonly keepTempDir?: boolean;
  readonly resolver?: DocumentResolver;
  readonly documents?: Readonly<Record<string, unknown>>;
  readonly rejectIncompatible?: boolean;
  readonly engineBuildHash?: string;
  readonly gasVersion?: number;
}

export async function buildStepArtifact(
  stepValue: unknown,
  scopeValue: ScopeDocument,
  options: BuildStepArtifactOptions = {},
): Promise<BuildStepArtifactResult> {
  const step = validateJavaScriptStep(stepValue);
  const scopeContracts = scopeValue.contracts ?? {};
  const selectedContracts = step.useContracts.map((name) => {
    const contract = scopeContracts[name];
    if (!contract) {
      throw new Error(`JavaScript environment contract not found: ${name}`);
    }
    return contract;
  });
  const merged = mergeJavaScriptEnvironmentContracts(selectedContracts);

  if (
    step.executionProfile &&
    step.executionProfile !== merged.executionProfile
  ) {
    throw new Error(
      `step executionProfile ${step.executionProfile} does not match contract profile ${merged.executionProfile}`,
    );
  }
  if (
    step.abi &&
    (step.abi.id !== merged.abi.id || step.abi.version !== merged.abi.version)
  ) {
    throw new Error(
      `step ABI ${step.abi.id}@${step.abi.version} does not match contract ABI ${merged.abi.id}@${merged.abi.version}`,
    );
  }

  const resolver =
    options.resolver ?? new MapDocumentResolver(options.documents ?? {});
  const libraries = await resolveAndVerifyImportLocks(merged.imports, resolver);
  for (const library of libraries) {
    if (
      library.artifact.processing.executionProfile !== merged.executionProfile
    ) {
      throw new Error(
        `library ${library.specifier} profile ${library.artifact.processing.executionProfile} does not match contract profile ${merged.executionProfile}`,
      );
    }
  }

  const tree = await createTempSourceTree('blue-js-step-');
  try {
    await writeSourceModule(tree.dir, './entry.js', step.entry);
    if (step.modules) {
      await writeModuleMap(tree.dir, step.modules);
    }
    for (const library of libraries) {
      const parsed = parsePackageImportSpecifier(library.specifier);
      await materializeModulePackAsPackage({
        root: tree.dir,
        packageName: library.artifact.package.name || parsed.packageName,
        packageVersion: library.artifact.package.version,
        modulePack: library.artifact.artifact.modulePack,
        exportSubpath: parsed.exportSubpath,
      });
    }

    const built = await buildDeterministicModulePack({
      absWorkingDir: tree.dir,
      entryPath: './entry.js',
      profile: merged.executionProfile,
      entryExport: step.entryExport ?? 'default',
      emitProgramArtifact: true,
      rejectIncompatible: options.rejectIncompatible ?? true,
      abiId: merged.abi.id,
      abiVersion: merged.abi.version,
      abiManifestHash: abiManifestHashFor(merged.abi.id),
      ...(options.engineBuildHash
        ? { engineBuildHash: options.engineBuildHash }
        : {}),
      ...(options.gasVersion !== undefined
        ? { gasVersion: options.gasVersion }
        : {}),
    });
    if (!built.programArtifact) {
      throw new Error('deterministic builder did not emit ProgramArtifact.v2');
    }
    return {
      programArtifact: built.programArtifact as ProgramArtifactV2,
      importedLibraries: libraries.map((library) => ({
        specifier: library.specifier,
        documentId: library.documentId,
        package: {
          registry: library.artifact.package.registry,
          name: library.artifact.package.name,
          version: library.artifact.package.version,
          sourceIntegritySha256:
            library.artifact.package.sourceIntegritySha256 ?? '',
        },
        graphHash: library.artifact.build.modulePackGraphHash,
      })),
    };
  } finally {
    if (!options.keepTempDir) {
      await tree.cleanup();
    }
  }
}

function abiManifestHashFor(abiId: string): string {
  if (abiId === 'Host.v2') {
    return HOST_V2_HASH;
  }
  return HOST_V1_HASH;
}
