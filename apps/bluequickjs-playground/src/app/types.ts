import type { AbiManifest } from '@blue-quickjs/abi-manifest';
import type { ProgramArtifactV2 } from '@blue-quickjs/quickjs-runtime';

export type HostPresetId = 'determinism' | 'certification';

export interface DocsLink {
  label: string;
  href: string;
}

export interface HostSummary {
  label: string;
  description: string;
  documents: string[];
}

export interface GalleryEntry {
  id: string;
  title: string;
  kind: 'example' | 'ecosystem-green' | 'flagship';
  badge: string;
  description: string;
  certified: boolean;
  executionProfile: string;
  sourceKind: ProgramArtifactV2['sourceKind'];
  abiId: string;
  gasLimit: string;
  sourcePaths: string[];
  sourceText: string;
  hostPreset: HostPresetId;
  hostSummary: HostSummary;
  docsLinks: DocsLink[];
  supportsOogSearch: boolean;
  program: ProgramArtifactV2;
  manifest: AbiManifest;
}

export interface EvidenceRecord {
  stage: string;
  resultHash: string | null;
  errorCode: string | null;
  errorTag: string | null;
  gasUsed: string;
  gasRemaining: string;
  tapeHash: string | null;
  tapeLength: number;
  certified: boolean;
  reportSource: string;
  fixtureCoverage: Array<{ suite: string; fixtureName: string }>;
}

export interface OogBoundaryRecord {
  firstSuccessGas: string;
  lastFailureGas: string;
  successGasUsed: string;
  successGasRemaining: string;
  failureGasUsed: string;
  failureGasRemaining: string;
  failureCode: string | null;
  failureTag: string | null;
}

export interface RedFixtureRecord {
  id: string;
  title: string;
  kind: string;
  executionProfile: string;
  failureStage: string;
  errorCode: string | null;
  errorTag: string | null;
  certified: boolean;
  docsLinks: DocsLink[];
  diagnostics: Array<{ filePath: string; ruleId: string; message: string }>;
  runtimeArtifact: ProgramArtifactV2 | null;
  reportSource: string;
}

export interface ExamplesPayload {
  generatedAt: string;
  metadata: {
    engineBuildHash: string | null;
    gasVersion: number | null;
    wasmVariant: string;
    wasmBuildType: string;
  };
  examples: GalleryEntry[];
}

export interface EvidencePayload {
  generatedAt: string;
  metadata: {
    engineBuildHash: string | null;
    gasVersion: number | null;
  };
  evidence: Record<string, EvidenceRecord>;
}

export interface OogPayload {
  generatedAt: string;
  metadata: {
    engineBuildHash: string | null;
    gasVersion: number | null;
  };
  boundaries: Record<string, OogBoundaryRecord>;
}

export interface RedPayload {
  generatedAt: string;
  metadata: {
    engineBuildHash: string | null;
    gasVersion: number | null;
  };
  fixtures: RedFixtureRecord[];
}

export interface LoadedPlaygroundData {
  examples: ExamplesPayload;
  evidence: EvidencePayload;
  oog: OogPayload;
  red: RedPayload;
}

export interface RunSnapshot {
  stage:
    | 'success'
    | 'artifact_validation'
    | 'runtime_error'
    | 'pin_enforcement';
  resultHash: string | null;
  errorCode: string | null;
  errorTag: string | null;
  gasUsed: string;
  gasRemaining: string;
  tapeHash: string | null;
  tapeLength: number;
}

export interface HostEvent {
  fn: 'document.get' | 'document.getCanonical' | 'emit';
  request: unknown;
  response: unknown;
  units: number;
}

export interface PlaygroundRunResult {
  ok: boolean;
  snapshot: RunSnapshot;
  value: unknown | null;
  errorMessage: string | null;
  hostEvents: HostEvent[];
  tape: unknown[];
  runtimeMetadata: {
    engineBuildHash: string | null;
    gasVersion: number | null;
    executionProfile: string;
    sourceKind: ProgramArtifactV2['sourceKind'];
    abiId: string;
    moduleGraphHash: string | null;
  };
}
