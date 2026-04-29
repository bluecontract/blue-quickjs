import type {
  DeterministicExecutionProfile,
  ModulePackV1,
  ProgramArtifactV2,
} from '@blue-quickjs/deterministic-builder';

export const BLUE_JS_LIBRARY_SOURCE_TYPE =
  'BlueQuickjs/JavaScript Library Source' as const;
export const BLUE_NPM_LIBRARY_SOURCE_TYPE =
  'BlueQuickjs/Npm Library Source' as const;
export const BLUE_JS_LIBRARY_ARTIFACT_TYPE =
  'BlueQuickjs/JavaScript Library Artifact' as const;
export const BLUE_JS_IMPORT_LOCK_TYPE =
  'BlueQuickjs/JavaScript Import Lock' as const;
export const BLUE_JS_ENVIRONMENT_CONTRACT_TYPE =
  'BlueQuickjs/JavaScript Environment Contract' as const;
export const BLUE_JS_STEP_TYPE = 'BlueQuickjs/JavaScript Step' as const;
export const MYOS_DOCUMENT_LINK_TYPE = 'MyOS/Document Link' as const;

export type JsonRecord = Record<string, unknown>;

export interface JavaScriptPackageIdentity {
  readonly registry: 'blue' | 'npm';
  readonly name: string;
  readonly version: string;
  readonly sourceIntegritySha256?: string;
}

export interface JavaScriptLibrarySourceDocument {
  readonly type: typeof BLUE_JS_LIBRARY_SOURCE_TYPE;
  readonly package: {
    readonly registry: 'blue';
    readonly name: string;
    readonly version: string;
  };
  readonly executionProfile: DeterministicExecutionProfile;
  readonly entry: string;
  readonly modules: Record<string, string>;
}

export interface NpmLibrarySourceDocument {
  readonly type: typeof BLUE_NPM_LIBRARY_SOURCE_TYPE;
  readonly npm: {
    readonly registryUrl: string;
    readonly name: string;
    readonly version: string;
    readonly integrity?: string;
    readonly packageDir?: string;
  };
  readonly executionProfile: DeterministicExecutionProfile;
  readonly entry?: string | 'auto';
}

export interface NpmOriginProvenance {
  readonly type: 'npm';
  readonly registryUrl: string;
  readonly packageName: string;
  readonly packageVersion: string;
  readonly tarballIntegrity?: string;
  readonly lockfileSha256: string;
}

export interface JavaScriptLibraryArtifactDocument {
  readonly type: typeof BLUE_JS_LIBRARY_ARTIFACT_TYPE;
  readonly package: JavaScriptPackageIdentity;
  readonly origin?: NpmOriginProvenance;
  readonly processing: {
    readonly runtime: 'BlueQuickjs';
    readonly sourceKind: 'module-pack';
    readonly modulePackVersion: 1;
    readonly programArtifactVersion: 2;
    readonly executionProfile: DeterministicExecutionProfile;
  };
  readonly build: {
    readonly builderVersion: string;
    readonly dependencyIntegritySha256: string;
    readonly modulePackGraphHash: string;
  };
  readonly artifact: {
    readonly modulePack: ModulePackV1;
  };
}

export interface MyOsDocumentLink {
  readonly type: typeof MYOS_DOCUMENT_LINK_TYPE;
  readonly documentId: string;
}

export interface JavaScriptImportLockDocument {
  readonly type: typeof BLUE_JS_IMPORT_LOCK_TYPE;
  readonly specifier: string;
  readonly library: MyOsDocumentLink;
  readonly requiredPackage: Required<JavaScriptPackageIdentity>;
  readonly requiredOrigin?: NpmOriginProvenance;
  readonly requiredBuild: {
    readonly builderVersion: string;
    readonly dependencyIntegritySha256: string;
    readonly modulePackGraphHash: string;
  };
}

export interface JavaScriptEnvironmentContractDocument {
  readonly type: typeof BLUE_JS_ENVIRONMENT_CONTRACT_TYPE;
  readonly executionProfile: DeterministicExecutionProfile;
  readonly abi: {
    readonly id: string;
    readonly version: number;
  };
  readonly imports: Record<string, JavaScriptImportLockDocument>;
}

export interface JavaScriptStepDocument {
  readonly type: typeof BLUE_JS_STEP_TYPE;
  readonly useContracts: readonly string[];
  readonly entry: string;
  readonly entryExport?: string;
  readonly modules?: Record<string, string>;
  readonly executionProfile?: DeterministicExecutionProfile;
  readonly abi?: {
    readonly id: string;
    readonly version: number;
  };
}

export interface ScopeDocument {
  readonly contracts?: Record<string, unknown>;
}

export interface BuildStepArtifactResult {
  readonly programArtifact: ProgramArtifactV2;
  readonly importedLibraries: readonly {
    readonly specifier: string;
    readonly documentId: string;
    readonly package: Required<JavaScriptPackageIdentity>;
    readonly graphHash: string;
  }[];
}
