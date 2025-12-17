import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type QuickjsWasmVariant = 'wasm32' | 'wasm64';

export const QUICKJS_WASM_BASENAME = 'quickjs-eval.wasm';
export const QUICKJS_WASM_LOADER_BASENAME = 'quickjs-eval.js';
export const QUICKJS_WASM64_BASENAME = 'quickjs-eval-wasm64.wasm';
export const QUICKJS_WASM64_LOADER_BASENAME = 'quickjs-eval-wasm64.js';
export const QUICKJS_WASM_METADATA_BASENAME =
  'quickjs-wasm-build.metadata.json';

const artifactDir = path.resolve(
  fileURLToPath(new URL('../..', import.meta.url)),
  'dist',
);

const ARTIFACTS: Record<QuickjsWasmVariant, { wasm: string; loader: string }> =
  {
    wasm32: {
      wasm: QUICKJS_WASM_BASENAME,
      loader: QUICKJS_WASM_LOADER_BASENAME,
    },
    wasm64: {
      wasm: QUICKJS_WASM64_BASENAME,
      loader: QUICKJS_WASM64_LOADER_BASENAME,
    },
  };

export function getQuickjsWasmArtifacts(
  variant: QuickjsWasmVariant = 'wasm32',
) {
  const entry = ARTIFACTS[variant];
  return {
    wasmPath: path.join(artifactDir, entry.wasm),
    loaderPath: path.join(artifactDir, entry.loader),
  };
}

export interface QuickjsWasmBuildArtifactInfo {
  filename: string;
  sha256: string;
  size: number;
}

export interface QuickjsWasmBuildVariantMetadata {
  engineBuildHash: string;
  wasm: QuickjsWasmBuildArtifactInfo;
  loader: QuickjsWasmBuildArtifactInfo;
}

export interface QuickjsWasmBuildMetadata {
  quickjsVersion: string;
  quickjsCommit: string | null;
  emscriptenVersion: string;
  engineBuildHash: string | null;
  variants: Partial<
    Record<QuickjsWasmVariant, QuickjsWasmBuildVariantMetadata>
  >;
}

export function getQuickjsWasmMetadataPath() {
  return path.join(artifactDir, QUICKJS_WASM_METADATA_BASENAME);
}

export function readQuickjsWasmMetadata(
  metadataPath: string = getQuickjsWasmMetadataPath(),
): QuickjsWasmBuildMetadata {
  if (!fs.existsSync(metadataPath)) {
    throw new Error(
      `QuickJS wasm metadata not found at ${metadataPath}. Did you run pnpm nx build quickjs-wasm-build?`,
    );
  }
  const raw = fs.readFileSync(metadataPath, 'utf8');
  return JSON.parse(raw) as QuickjsWasmBuildMetadata;
}
