import path from 'node:path';

import {
  QUICKJS_WASM_BASENAME,
  QUICKJS_WASM_LOADER_BASENAME,
  getQuickjsWasmArtifacts,
} from './quickjs-wasm-build.js';

describe('getQuickjsWasmArtifacts', () => {
  const normalize = (p: string) => p.split(path.sep).join('/');

  it('returns stable dist paths', () => {
    const artifacts = getQuickjsWasmArtifacts();
    const wasm = normalize(artifacts.wasmPath);
    const loader = normalize(artifacts.loaderPath);

    expect(wasm).toMatch(/libs\/quickjs-wasm-build\/dist\/quickjs-eval\.wasm$/);
    expect(loader).toMatch(/libs\/quickjs-wasm-build\/dist\/quickjs-eval\.js$/);
  });

  it('exports the artifact basenames', () => {
    expect(QUICKJS_WASM_BASENAME).toBe('quickjs-eval.wasm');
    expect(QUICKJS_WASM_LOADER_BASENAME).toBe('quickjs-eval.js');
  });
});
