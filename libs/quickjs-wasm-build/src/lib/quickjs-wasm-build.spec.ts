import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  QUICKJS_WASM_BASENAME,
  QUICKJS_WASM_LOADER_BASENAME,
  QUICKJS_WASM64_BASENAME,
  QUICKJS_WASM64_LOADER_BASENAME,
  QUICKJS_WASM_METADATA_BASENAME,
  getQuickjsWasmArtifacts,
  getQuickjsWasmMetadataPath,
  readQuickjsWasmMetadata,
} from './quickjs-wasm-build.js';

const normalize = (p: string) => p.split(path.sep).join('/');

describe('getQuickjsWasmArtifacts', () => {
  it('returns stable dist paths (wasm32 default)', () => {
    const artifacts = getQuickjsWasmArtifacts();
    const wasm = normalize(artifacts.wasmPath);
    const loader = normalize(artifacts.loaderPath);

    expect(wasm).toMatch(/libs\/quickjs-wasm-build\/dist\/quickjs-eval\.wasm$/);
    expect(loader).toMatch(/libs\/quickjs-wasm-build\/dist\/quickjs-eval\.js$/);
  });

  it('returns stable dist paths (wasm64)', () => {
    const artifacts = getQuickjsWasmArtifacts('wasm64');
    const wasm = normalize(artifacts.wasmPath);
    const loader = normalize(artifacts.loaderPath);

    expect(wasm).toMatch(
      /libs\/quickjs-wasm-build\/dist\/quickjs-eval-wasm64\.wasm$/,
    );
    expect(loader).toMatch(
      /libs\/quickjs-wasm-build\/dist\/quickjs-eval-wasm64\.js$/,
    );
  });

  it('exports the artifact basenames', () => {
    expect(QUICKJS_WASM_BASENAME).toBe('quickjs-eval.wasm');
    expect(QUICKJS_WASM_LOADER_BASENAME).toBe('quickjs-eval.js');
    expect(QUICKJS_WASM64_BASENAME).toBe('quickjs-eval-wasm64.wasm');
    expect(QUICKJS_WASM64_LOADER_BASENAME).toBe('quickjs-eval-wasm64.js');
  });
});

describe('metadata helpers', () => {
  it('returns stable metadata path', () => {
    const metadataPath = normalize(getQuickjsWasmMetadataPath());
    expect(metadataPath).toMatch(
      /libs\/quickjs-wasm-build\/dist\/quickjs-wasm-build\.metadata\.json$/,
    );
    expect(QUICKJS_WASM_METADATA_BASENAME).toBe(
      'quickjs-wasm-build.metadata.json',
    );
  });

  it('reads metadata from a custom path', () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'quickjs-wasm-build-meta-'),
    );
    const metadataPath = path.join(tempDir, 'meta.json');
    const sample = {
      quickjsVersion: '2024-01-01',
      quickjsCommit: 'abc123',
      emscriptenVersion: '3.1.56',
      engineBuildHash: 'deadbeef',
      build: {
        memory: {
          initial: 33554432,
          maximum: 33554432,
          stackSize: 1048576,
          allowGrowth: false,
        },
        determinism: {
          sourceDateEpoch: 1704067200,
          flags: ['-sDETERMINISTIC=1', '-sFILESYSTEM=0'],
        },
      },
      variants: {
        wasm32: {
          engineBuildHash: 'deadbeef',
          variantFlags: [],
          wasm: {
            filename: 'quickjs-eval.wasm',
            sha256: 'aa',
            size: 1,
          },
          loader: {
            filename: 'quickjs-eval.js',
            sha256: 'bb',
            size: 2,
          },
        },
      },
    };
    fs.writeFileSync(metadataPath, JSON.stringify(sample), 'utf8');

    const parsed = readQuickjsWasmMetadata(metadataPath);
    expect(parsed).toEqual(sample);
  });
});
