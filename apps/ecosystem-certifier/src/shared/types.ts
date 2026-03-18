import type { AbiManifest } from '@blue-quickjs/abi-manifest';
import type { ProgramArtifactV2 } from '@blue-quickjs/quickjs-runtime';

export type FixtureKind = 'flagship' | 'positive' | 'negative';

export type FailureStage =
  | 'builder_reject'
  | 'artifact_validation'
  | 'runtime_error'
  | 'pin_enforcement';

export interface BuildFixtureDefinition {
  id: string;
  title: string;
  kind: FixtureKind;
  entryPath: string;
  profile:
    | 'baseline-v1'
    | 'compat-regexp-v1'
    | 'compat-general-v1'
    | 'compat-binary-v1';
  abiId: 'Host.v1' | 'Host.v2';
  abiVersion: 1 | 2;
  abiManifestHash: string;
  gasLimit: bigint;
  expect:
    | {
        stage: 'success';
      }
    | {
        stage: FailureStage;
        errorCode?: string;
        errorTag?: string;
      };
}

export interface BrowserEvaluationCase {
  id: string;
  title: string;
  kind: FixtureKind;
  gasLimit: string;
  manifest: AbiManifest;
  program: ProgramArtifactV2;
}

export interface FixtureSnapshot {
  stage: 'success' | FailureStage;
  resultHash: string | null;
  errorCode: string | null;
  errorTag: string | null;
  gasUsed: string;
  gasRemaining: string;
  tapeHash: string | null;
  tapeLength: number;
}

export interface FixtureParityRecord {
  id: string;
  title: string;
  kind: FixtureKind;
  node: FixtureSnapshot;
  browser: FixtureSnapshot | null;
  match: boolean;
}

export interface CertificationReport {
  generatedAt: string;
  summary: {
    total: number;
    withBrowserRuns: number;
    mismatches: number;
    greenCount: number;
    redCount: number;
  };
  records: FixtureParityRecord[];
}
