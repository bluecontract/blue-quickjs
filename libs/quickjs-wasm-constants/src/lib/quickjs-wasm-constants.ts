export type QuickjsWasmVariant = 'wasm32' | 'wasm64';
export type QuickjsWasmBuildType = 'release' | 'debug';

export const QUICKJS_WASM_BASENAME = 'quickjs-eval.wasm';
export const QUICKJS_WASM_LOADER_BASENAME = 'quickjs-eval.js';
export const QUICKJS_WASM_DEBUG_BASENAME = 'quickjs-eval-debug.wasm';
export const QUICKJS_WASM_DEBUG_LOADER_BASENAME = 'quickjs-eval-debug.js';
export const QUICKJS_WASM64_BASENAME = 'quickjs-eval-wasm64.wasm';
export const QUICKJS_WASM64_LOADER_BASENAME = 'quickjs-eval-wasm64.js';
export const QUICKJS_WASM64_DEBUG_BASENAME = 'quickjs-eval-wasm64-debug.wasm';
export const QUICKJS_WASM64_DEBUG_LOADER_BASENAME =
  'quickjs-eval-wasm64-debug.js';
export const QUICKJS_WASM_METADATA_BASENAME =
  'quickjs-wasm-build.metadata.json';

export interface QuickjsWasmBuildArtifactInfo {
  filename: string;
  sha256: string;
  size: number;
}

export interface QuickjsWasmBuildVariantMetadata {
  engineBuildHash: string;
  wasm: QuickjsWasmBuildArtifactInfo;
  loader: QuickjsWasmBuildArtifactInfo;
  variantFlags?: string[];
  buildType: QuickjsWasmBuildType;
  buildFlags?: string[];
}

export interface QuickjsWasmMemoryConfig {
  initial: number | null;
  maximum: number | null;
  stackSize: number | null;
  allowGrowth: boolean;
}

export interface QuickjsWasmDeterminismConfig {
  sourceDateEpoch: number | null;
  flags: string[];
}

export interface QuickjsWasmBuildConfig {
  memory: QuickjsWasmMemoryConfig;
  determinism: QuickjsWasmDeterminismConfig;
}

export interface QuickjsWasmBuildMetadata {
  quickjsVersion: string;
  quickjsCommit: string | null;
  emscriptenVersion: string;
  engineBuildHash: string | null;
  build: QuickjsWasmBuildConfig;
  variants: Partial<
    Record<
      QuickjsWasmVariant,
      Partial<Record<QuickjsWasmBuildType, QuickjsWasmBuildVariantMetadata>>
    >
  >;
}
