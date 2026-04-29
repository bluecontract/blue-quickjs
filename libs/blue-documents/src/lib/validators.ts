import type {
  ModulePackModule,
  ModulePackV1,
} from '@blue-quickjs/deterministic-builder';
import {
  BLUE_JS_ENVIRONMENT_CONTRACT_TYPE,
  BLUE_JS_IMPORT_LOCK_TYPE,
  BLUE_JS_LIBRARY_ARTIFACT_TYPE,
  BLUE_JS_LIBRARY_SOURCE_TYPE,
  BLUE_JS_STEP_TYPE,
  BLUE_NPM_LIBRARY_SOURCE_TYPE,
  MYOS_DOCUMENT_LINK_TYPE,
  type JavaScriptEnvironmentContractDocument,
  type JavaScriptImportLockDocument,
  type JavaScriptLibraryArtifactDocument,
  type JavaScriptLibrarySourceDocument,
  type JavaScriptStepDocument,
  type NpmLibrarySourceDocument,
  type NpmOriginProvenance,
} from './types.js';

const KNOWN_PROFILES = new Set([
  'baseline-v1',
  'compat-general-v1',
  'compat-binary-v1',
]);

export class BlueDocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlueDocumentValidationError';
  }
}

export function validateJavaScriptLibrarySource(
  value: unknown,
): JavaScriptLibrarySourceDocument {
  const record = expectRecord(value, 'document');
  expectLiteral(record.type, BLUE_JS_LIBRARY_SOURCE_TYPE, 'document.type');
  const packageRecord = expectRecord(record.package, 'document.package');
  expectLiteral(packageRecord.registry, 'blue', 'document.package.registry');
  const packageName = expectNonEmptyString(
    packageRecord.name,
    'document.package.name',
  );
  const packageVersion = expectNonEmptyString(
    packageRecord.version,
    'document.package.version',
  );
  const executionProfile = expectExecutionProfile(
    record.executionProfile,
    'document.executionProfile',
  );
  const entry = expectModulePath(record.entry, 'document.entry');
  const rawModules = expectRecord(record.modules, 'document.modules');
  const modules: Record<string, string> = {};
  for (const [specifier, source] of Object.entries(rawModules)) {
    const modulePath = expectModulePath(
      specifier,
      `document.modules.${specifier}`,
    );
    modules[modulePath] = expectString(source, `document.modules.${specifier}`);
  }
  if (!Object.prototype.hasOwnProperty.call(modules, entry)) {
    throw new BlueDocumentValidationError(
      `document.modules must include entry module ${entry}`,
    );
  }
  return {
    type: BLUE_JS_LIBRARY_SOURCE_TYPE,
    package: {
      registry: 'blue',
      name: packageName,
      version: packageVersion,
    },
    executionProfile,
    entry,
    modules,
  };
}

export function validateNpmLibrarySource(
  value: unknown,
): NpmLibrarySourceDocument {
  const record = expectRecord(value, 'document');
  expectLiteral(record.type, BLUE_NPM_LIBRARY_SOURCE_TYPE, 'document.type');
  const npm = expectRecord(record.npm, 'document.npm');
  const source: NpmLibrarySourceDocument = {
    type: BLUE_NPM_LIBRARY_SOURCE_TYPE,
    npm: {
      registryUrl: expectNonEmptyString(
        npm.registryUrl,
        'document.npm.registryUrl',
      ),
      name: expectNonEmptyString(npm.name, 'document.npm.name'),
      version: expectNonEmptyString(npm.version, 'document.npm.version'),
      ...(npm.integrity !== undefined
        ? {
            integrity: expectNonEmptyString(
              npm.integrity,
              'document.npm.integrity',
            ),
          }
        : {}),
      ...(npm.packageDir !== undefined
        ? {
            packageDir: expectNonEmptyString(
              npm.packageDir,
              'document.npm.packageDir',
            ),
          }
        : {}),
    },
    executionProfile: expectExecutionProfile(
      record.executionProfile,
      'document.executionProfile',
    ),
    ...(record.entry !== undefined
      ? { entry: expectNonEmptyString(record.entry, 'document.entry') }
      : {}),
  };
  return source;
}

export function validateJavaScriptLibraryArtifact(
  value: unknown,
): JavaScriptLibraryArtifactDocument {
  const record = expectRecord(value, 'document');
  expectLiteral(record.type, BLUE_JS_LIBRARY_ARTIFACT_TYPE, 'document.type');
  const packageRecord = expectRecord(record.package, 'document.package');
  const registry = expectRegistry(
    packageRecord.registry,
    'document.package.registry',
  );
  const processing = expectRecord(record.processing, 'document.processing');
  expectLiteral(
    processing.runtime,
    'BlueQuickjs',
    'document.processing.runtime',
  );
  expectLiteral(
    processing.sourceKind,
    'module-pack',
    'document.processing.sourceKind',
  );
  expectLiteral(
    processing.modulePackVersion,
    1,
    'document.processing.modulePackVersion',
  );
  expectLiteral(
    processing.programArtifactVersion,
    2,
    'document.processing.programArtifactVersion',
  );
  const build = expectRecord(record.build, 'document.build');
  const artifact = expectRecord(record.artifact, 'document.artifact');
  const modulePack = validateModulePack(
    artifact.modulePack,
    'document.artifact.modulePack',
  );
  const doc: JavaScriptLibraryArtifactDocument = {
    type: BLUE_JS_LIBRARY_ARTIFACT_TYPE,
    package: {
      registry,
      name: expectNonEmptyString(packageRecord.name, 'document.package.name'),
      version: expectNonEmptyString(
        packageRecord.version,
        'document.package.version',
      ),
      sourceIntegritySha256: expectHex64(
        packageRecord.sourceIntegritySha256,
        'document.package.sourceIntegritySha256',
      ),
    },
    ...(record.origin !== undefined
      ? { origin: validateNpmOrigin(record.origin, 'document.origin') }
      : {}),
    processing: {
      runtime: 'BlueQuickjs',
      sourceKind: 'module-pack',
      modulePackVersion: 1,
      programArtifactVersion: 2,
      executionProfile: expectExecutionProfile(
        processing.executionProfile,
        'document.processing.executionProfile',
      ),
    },
    build: {
      builderVersion: expectNonEmptyString(
        build.builderVersion,
        'document.build.builderVersion',
      ),
      dependencyIntegritySha256: expectHex64(
        build.dependencyIntegritySha256,
        'document.build.dependencyIntegritySha256',
      ),
      modulePackGraphHash: expectHex64(
        build.modulePackGraphHash,
        'document.build.modulePackGraphHash',
      ),
    },
    artifact: { modulePack },
  };
  if (doc.build.modulePackGraphHash !== modulePack.graphHash) {
    throw new BlueDocumentValidationError(
      'document.build.modulePackGraphHash must match artifact.modulePack.graphHash',
    );
  }
  if (doc.build.builderVersion !== modulePack.builderVersion) {
    throw new BlueDocumentValidationError(
      'document.build.builderVersion must match artifact.modulePack.builderVersion',
    );
  }
  if (doc.build.dependencyIntegritySha256 !== modulePack.dependencyIntegrity) {
    throw new BlueDocumentValidationError(
      'document.build.dependencyIntegritySha256 must match artifact.modulePack.dependencyIntegrity',
    );
  }
  if (doc.package.registry === 'npm' && !doc.origin) {
    throw new BlueDocumentValidationError(
      'npm library artifacts require origin',
    );
  }
  return doc;
}

export function validateJavaScriptImportLock(
  value: unknown,
): JavaScriptImportLockDocument {
  const record = expectRecord(value, 'importLock');
  expectLiteral(record.type, BLUE_JS_IMPORT_LOCK_TYPE, 'importLock.type');
  const library = expectRecord(record.library, 'importLock.library');
  expectLiteral(
    library.type,
    MYOS_DOCUMENT_LINK_TYPE,
    'importLock.library.type',
  );
  const requiredPackage = expectRecord(
    record.requiredPackage,
    'importLock.requiredPackage',
  );
  const requiredBuild = expectRecord(
    record.requiredBuild,
    'importLock.requiredBuild',
  );
  const lock: JavaScriptImportLockDocument = {
    type: BLUE_JS_IMPORT_LOCK_TYPE,
    specifier: expectNonEmptyString(record.specifier, 'importLock.specifier'),
    library: {
      type: MYOS_DOCUMENT_LINK_TYPE,
      documentId: expectNonEmptyString(
        library.documentId,
        'importLock.library.documentId',
      ),
    },
    requiredPackage: {
      registry: expectRegistry(
        requiredPackage.registry,
        'importLock.requiredPackage.registry',
      ),
      name: expectNonEmptyString(
        requiredPackage.name,
        'importLock.requiredPackage.name',
      ),
      version: expectNonEmptyString(
        requiredPackage.version,
        'importLock.requiredPackage.version',
      ),
      sourceIntegritySha256: expectHex64(
        requiredPackage.sourceIntegritySha256,
        'importLock.requiredPackage.sourceIntegritySha256',
      ),
    },
    ...(record.requiredOrigin !== undefined
      ? {
          requiredOrigin: validateNpmOrigin(
            record.requiredOrigin,
            'importLock.requiredOrigin',
          ),
        }
      : {}),
    requiredBuild: {
      builderVersion: expectNonEmptyString(
        requiredBuild.builderVersion,
        'importLock.requiredBuild.builderVersion',
      ),
      dependencyIntegritySha256: expectHex64(
        requiredBuild.dependencyIntegritySha256,
        'importLock.requiredBuild.dependencyIntegritySha256',
      ),
      modulePackGraphHash: expectHex64(
        requiredBuild.modulePackGraphHash,
        'importLock.requiredBuild.modulePackGraphHash',
      ),
    },
  };
  if (lock.requiredPackage.registry === 'npm' && !lock.requiredOrigin) {
    throw new BlueDocumentValidationError(
      'npm import locks require requiredOrigin',
    );
  }
  return lock;
}

export function validateJavaScriptEnvironmentContract(
  value: unknown,
): JavaScriptEnvironmentContractDocument {
  const record = expectRecord(value, 'contract');
  expectLiteral(
    record.type,
    BLUE_JS_ENVIRONMENT_CONTRACT_TYPE,
    'contract.type',
  );
  const abi = expectRecord(record.abi, 'contract.abi');
  const importsRecord = expectRecord(record.imports, 'contract.imports');
  const imports: Record<string, JavaScriptImportLockDocument> = {};
  for (const [specifier, lock] of Object.entries(importsRecord)) {
    const validated = validateJavaScriptImportLock(lock);
    if (validated.specifier !== specifier) {
      throw new BlueDocumentValidationError(
        `contract.imports.${specifier}.specifier must match its map key`,
      );
    }
    imports[specifier] = validated;
  }
  return {
    type: BLUE_JS_ENVIRONMENT_CONTRACT_TYPE,
    executionProfile: expectExecutionProfile(
      record.executionProfile,
      'contract.executionProfile',
    ),
    abi: {
      id: expectNonEmptyString(abi.id, 'contract.abi.id'),
      version: expectPositiveInteger(abi.version, 'contract.abi.version'),
    },
    imports,
  };
}

export function validateJavaScriptStep(value: unknown): JavaScriptStepDocument {
  const record = expectRecord(value, 'step');
  expectLiteral(record.type, BLUE_JS_STEP_TYPE, 'step.type');
  const useContracts = expectStringArray(
    record.useContracts,
    'step.useContracts',
  );
  const modules =
    record.modules === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(expectRecord(record.modules, 'step.modules')).map(
            ([specifier, source]) => [
              expectModulePath(specifier, `step.modules.${specifier}`),
              expectString(source, `step.modules.${specifier}`),
            ],
          ),
        );
  const abi =
    record.abi === undefined ? undefined : expectRecord(record.abi, 'step.abi');
  return {
    type: BLUE_JS_STEP_TYPE,
    useContracts,
    entry: expectString(record.entry, 'step.entry'),
    ...(record.entryExport !== undefined
      ? {
          entryExport: expectNonEmptyString(
            record.entryExport,
            'step.entryExport',
          ),
        }
      : {}),
    ...(modules ? { modules } : {}),
    ...(record.executionProfile !== undefined
      ? {
          executionProfile: expectExecutionProfile(
            record.executionProfile,
            'step.executionProfile',
          ),
        }
      : {}),
    ...(abi
      ? {
          abi: {
            id: expectNonEmptyString(abi.id, 'step.abi.id'),
            version: expectPositiveInteger(abi.version, 'step.abi.version'),
          },
        }
      : {}),
  };
}

function validateNpmOrigin(value: unknown, path: string): NpmOriginProvenance {
  const record = expectRecord(value, path);
  expectLiteral(record.type, 'npm', `${path}.type`);
  return {
    type: 'npm',
    registryUrl: expectNonEmptyString(
      record.registryUrl,
      `${path}.registryUrl`,
    ),
    packageName: expectNonEmptyString(
      record.packageName,
      `${path}.packageName`,
    ),
    packageVersion: expectNonEmptyString(
      record.packageVersion,
      `${path}.packageVersion`,
    ),
    ...(record.tarballIntegrity !== undefined
      ? {
          tarballIntegrity: expectNonEmptyString(
            record.tarballIntegrity,
            `${path}.tarballIntegrity`,
          ),
        }
      : {}),
    lockfileSha256: expectHex64(
      record.lockfileSha256,
      `${path}.lockfileSha256`,
    ),
  };
}

function validateModulePack(value: unknown, path: string): ModulePackV1 {
  const record = expectRecord(value, path);
  expectLiteral(record.version, 1, `${path}.version`);
  const modules = expectArray(record.modules, `${path}.modules`).map(
    (module, index): ModulePackModule => {
      const moduleRecord = expectRecord(module, `${path}.modules[${index}]`);
      return {
        specifier: expectNonEmptyString(
          moduleRecord.specifier,
          `${path}.modules[${index}].specifier`,
        ),
        source: expectString(
          moduleRecord.source,
          `${path}.modules[${index}].source`,
        ),
        ...(moduleRecord.sourceMap !== undefined
          ? {
              sourceMap: expectString(
                moduleRecord.sourceMap,
                `${path}.modules[${index}].sourceMap`,
              ),
            }
          : {}),
      };
    },
  );
  return {
    version: 1,
    entrySpecifier: expectNonEmptyString(
      record.entrySpecifier,
      `${path}.entrySpecifier`,
    ),
    entryExport:
      record.entryExport === undefined
        ? 'default'
        : expectNonEmptyString(record.entryExport, `${path}.entryExport`),
    modules,
    graphHash: expectHex64(record.graphHash, `${path}.graphHash`),
    builderVersion: expectNonEmptyString(
      record.builderVersion,
      `${path}.builderVersion`,
    ),
    dependencyIntegrity: expectHex64(
      record.dependencyIntegrity,
      `${path}.dependencyIntegrity`,
    ),
    ...(record.diagnosticsMeta !== undefined
      ? {
          diagnosticsMeta: validateModulePackDiagnosticsMeta(
            record.diagnosticsMeta,
            `${path}.diagnosticsMeta`,
          ),
        }
      : {}),
  };
}

function validateModulePackDiagnosticsMeta(
  value: unknown,
  path: string,
): NonNullable<ModulePackV1['diagnosticsMeta']> {
  const record = expectRecord(value, path);
  return {
    entryPath: expectNonEmptyString(record.entryPath, `${path}.entryPath`),
    modulePaths: expectStringArray(record.modulePaths, `${path}.modulePaths`),
  };
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BlueDocumentValidationError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new BlueDocumentValidationError(`${path} must be an array`);
  }
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new BlueDocumentValidationError(`${path} must be a string`);
  }
  return value;
}

function expectNonEmptyString(value: unknown, path: string): string {
  const text = expectString(value, path).trim();
  if (!text) {
    throw new BlueDocumentValidationError(`${path} must be a non-empty string`);
  }
  return text;
}

function expectStringArray(value: unknown, path: string): string[] {
  return expectArray(value, path).map((item, index) =>
    expectNonEmptyString(item, `${path}[${index}]`),
  );
}

function expectLiteral<T extends string | number>(
  value: unknown,
  expected: T,
  path: string,
): T {
  if (value !== expected) {
    throw new BlueDocumentValidationError(
      `${path} must be ${JSON.stringify(expected)}`,
    );
  }
  return expected;
}

function expectExecutionProfile(value: unknown, path: string) {
  const profile = expectNonEmptyString(value, path);
  if (!KNOWN_PROFILES.has(profile)) {
    throw new BlueDocumentValidationError(
      `${path} must be a known execution profile`,
    );
  }
  return profile as 'baseline-v1' | 'compat-general-v1' | 'compat-binary-v1';
}

function expectRegistry(value: unknown, path: string): 'blue' | 'npm' {
  if (value !== 'blue' && value !== 'npm') {
    throw new BlueDocumentValidationError(`${path} must be "blue" or "npm"`);
  }
  return value;
}

function expectHex64(value: unknown, path: string): string {
  const text = expectNonEmptyString(value, path);
  if (!/^[0-9a-f]{64}$/.test(text)) {
    throw new BlueDocumentValidationError(
      `${path} must be a lowercase 64-char hex string`,
    );
  }
  return text;
}

function expectPositiveInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new BlueDocumentValidationError(`${path} must be a positive integer`);
  }
  return value as number;
}

function expectModulePath(value: unknown, path: string): string {
  const specifier = expectNonEmptyString(value, path);
  if (!specifier.startsWith('./')) {
    throw new BlueDocumentValidationError(`${path} must start with ./`);
  }
  if (specifier.includes('\\')) {
    throw new BlueDocumentValidationError(`${path} must use / separators`);
  }
  if (specifier.includes('/../') || specifier.endsWith('/..')) {
    throw new BlueDocumentValidationError(
      `${path} must not contain .. traversal`,
    );
  }
  return specifier;
}
