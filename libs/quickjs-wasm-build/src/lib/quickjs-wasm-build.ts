import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const QUICKJS_WASM_BASENAME = 'quickjs-eval.wasm';
export const QUICKJS_WASM_LOADER_BASENAME = 'quickjs-eval.js';

const artifactDir = path.resolve(
  fileURLToPath(new URL('../..', import.meta.url)),
  'dist',
);

export function getQuickjsWasmArtifacts() {
  return {
    wasmPath: path.join(artifactDir, QUICKJS_WASM_BASENAME),
    loaderPath: path.join(artifactDir, QUICKJS_WASM_LOADER_BASENAME),
  };
}
