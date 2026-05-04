import { describe, expect, it } from 'vitest';

import {
  QUICKJS_WASM64_BASENAME,
  QUICKJS_WASM64_DEBUG_BASENAME,
  QUICKJS_WASM64_DEBUG_LOADER_BASENAME,
  QUICKJS_WASM64_LOADER_BASENAME,
  QUICKJS_WASM_BASENAME,
  QUICKJS_WASM_DEBUG_BASENAME,
  QUICKJS_WASM_DEBUG_LOADER_BASENAME,
  QUICKJS_WASM_LOADER_BASENAME,
  QUICKJS_WASM_METADATA_BASENAME,
} from './quickjs-wasm-constants.js';

describe('quickjs-wasm constants', () => {
  it('exports the canonical wasm32 artifact basenames', () => {
    expect(QUICKJS_WASM_BASENAME).toBe('quickjs-eval.wasm');
    expect(QUICKJS_WASM_LOADER_BASENAME).toBe('quickjs-eval.js');
    expect(QUICKJS_WASM_DEBUG_BASENAME).toBe('quickjs-eval-debug.wasm');
    expect(QUICKJS_WASM_DEBUG_LOADER_BASENAME).toBe('quickjs-eval-debug.js');
  });

  it('exports the optional wasm64 artifact basenames', () => {
    expect(QUICKJS_WASM64_BASENAME).toBe('quickjs-eval-wasm64.wasm');
    expect(QUICKJS_WASM64_LOADER_BASENAME).toBe('quickjs-eval-wasm64.js');
    expect(QUICKJS_WASM64_DEBUG_BASENAME).toBe(
      'quickjs-eval-wasm64-debug.wasm',
    );
    expect(QUICKJS_WASM64_DEBUG_LOADER_BASENAME).toBe(
      'quickjs-eval-wasm64-debug.js',
    );
  });

  it('keeps every artifact basename unique and stable', () => {
    const basenames = [
      QUICKJS_WASM_BASENAME,
      QUICKJS_WASM_LOADER_BASENAME,
      QUICKJS_WASM_DEBUG_BASENAME,
      QUICKJS_WASM_DEBUG_LOADER_BASENAME,
      QUICKJS_WASM64_BASENAME,
      QUICKJS_WASM64_LOADER_BASENAME,
      QUICKJS_WASM64_DEBUG_BASENAME,
      QUICKJS_WASM64_DEBUG_LOADER_BASENAME,
      QUICKJS_WASM_METADATA_BASENAME,
    ];

    expect(new Set(basenames).size).toBe(basenames.length);
    expect(basenames).toEqual([
      'quickjs-eval.wasm',
      'quickjs-eval.js',
      'quickjs-eval-debug.wasm',
      'quickjs-eval-debug.js',
      'quickjs-eval-wasm64.wasm',
      'quickjs-eval-wasm64.js',
      'quickjs-eval-wasm64-debug.wasm',
      'quickjs-eval-wasm64-debug.js',
      'quickjs-wasm-build.metadata.json',
    ]);
  });
});
