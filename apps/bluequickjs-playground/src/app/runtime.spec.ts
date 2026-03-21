import { HOST_V1_HASH, HOST_V2_HASH } from '@blue-quickjs/abi-manifest';
import {
  compareAgainstEvidence,
  createScriptArtifact,
  defaultManifestForArtifact,
  parseArtifactJson,
} from './runtime.js';

describe('playground runtime helpers', () => {
  const metadata = {
    engineBuildHash: 'a'.repeat(64),
    gasVersion: 8,
    wasmVariant: 'wasm32',
    wasmBuildType: 'release',
  };

  it('creates baseline script artifacts against Host.v1', () => {
    const artifact = createScriptArtifact(
      '(() => 1)();',
      'baseline-v1',
      metadata,
    );
    expect(artifact.abiId).toBe('Host.v1');
    expect(artifact.abiManifestHash).toBe(HOST_V1_HASH);
    expect(artifact.engineBuildHash).toBe(metadata.engineBuildHash);
  });

  it('creates binary script artifacts against Host.v2', () => {
    const artifact = createScriptArtifact(
      '(() => Host.v2.document.get("bytes/payload"))();',
      'compat-binary-v1',
      metadata,
    );
    expect(artifact.abiId).toBe('Host.v2');
    expect(artifact.abiManifestHash).toBe(HOST_V2_HASH);
    expect(defaultManifestForArtifact(artifact).abi_id).toBe('Host.v2');
  });

  it('parses artifact json through runtime validation', () => {
    const artifact = createScriptArtifact(
      '(() => 1)();',
      'baseline-v1',
      metadata,
    );
    expect(parseArtifactJson(JSON.stringify(artifact))).toEqual(artifact);
  });

  it('compares run snapshots against certified evidence', () => {
    const result = compareAgainstEvidence(
      {
        ok: true,
        snapshot: {
          stage: 'success',
          resultHash: 'a',
          errorCode: null,
          errorTag: null,
          gasUsed: '10',
          gasRemaining: '90',
          tapeHash: null,
          tapeLength: 0,
        },
        value: 1,
        errorMessage: null,
        hostEvents: [],
        tape: [],
        runtimeMetadata: {
          engineBuildHash: metadata.engineBuildHash,
          gasVersion: 8,
          executionProfile: 'baseline-v1',
          sourceKind: 'script',
          abiId: 'Host.v1',
          moduleGraphHash: null,
        },
      },
      {
        stage: 'success',
        resultHash: 'a',
        errorCode: null,
        errorTag: null,
        gasUsed: '10',
        gasRemaining: '90',
        tapeHash: null,
        tapeLength: 0,
        certified: true,
        reportSource: 'fixture',
        fixtureCoverage: [],
      },
    );

    expect(result.matches).toBe(true);
    expect(result.differences).toEqual([]);
  });
});
