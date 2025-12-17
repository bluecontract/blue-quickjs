import {
  getQuickjsWasmArtifact,
  listAvailableQuickjsWasmVariants,
  loadQuickjsWasmBinary,
  loadQuickjsWasmLoaderSource,
  loadQuickjsWasmMetadata,
} from './quickjs-wasm.js';

const WASM_MAGIC_HEADER = [0x00, 0x61, 0x73, 0x6d];

describe('quickjs wasm artifacts', () => {
  it('exposes build metadata with at least one variant', async () => {
    const metadata = await loadQuickjsWasmMetadata();
    expect(metadata.quickjsVersion).toBeTruthy();
    expect(Object.keys(metadata.variants ?? {})).not.toHaveLength(0);
  });

  it('loads wasm bytes for each available variant', async () => {
    const metadata = await loadQuickjsWasmMetadata();
    const variants = listAvailableQuickjsWasmVariants(metadata);
    expect(variants.length).toBeGreaterThan(0);

    for (const variant of variants) {
      const bytes = await loadQuickjsWasmBinary(variant, metadata);
      expect(bytes.length).toBeGreaterThan(WASM_MAGIC_HEADER.length);
      expect(Array.from(bytes.slice(0, WASM_MAGIC_HEADER.length))).toEqual(
        WASM_MAGIC_HEADER,
      );
    }
  });

  it('resolves loader source for each available variant', async () => {
    const metadata = await loadQuickjsWasmMetadata();
    const variants = listAvailableQuickjsWasmVariants(metadata);
    expect(variants.length).toBeGreaterThan(0);

    for (const variant of variants) {
      const artifact = await getQuickjsWasmArtifact(variant, metadata);
      const loaderSource = await loadQuickjsWasmLoaderSource(variant, metadata);
      expect(loaderSource.length).toBeGreaterThan(0);
      expect(loaderSource).toContain('host_call');
      expect(artifact.variantMetadata.engineBuildHash).toBeTruthy();
    }
  });
});
