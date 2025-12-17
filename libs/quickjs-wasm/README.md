# quickjs-wasm

Deterministic QuickJS-in-Wasm artifacts packaged for consumption by the SDK/runtime. The package ships the wasm binary, its Emscripten loader, and the build metadata emitted by `quickjs-wasm-build`.

## Usage

```ts
import {
  getQuickjsWasmArtifact,
  loadQuickjsWasmBinary,
  loadQuickjsWasmLoaderSource,
  loadQuickjsWasmMetadata,
} from '@blue-quickjs/quickjs-wasm';

const metadata = await loadQuickjsWasmMetadata(); // includes engineBuildHash + flags
const artifact = await getQuickjsWasmArtifact(); // defaults to wasm32
const wasmBytes = await loadQuickjsWasmBinary(artifact.variant, metadata);
const loaderSource = await loadQuickjsWasmLoaderSource(artifact.variant, metadata);
```

`getQuickjsWasmArtifact` resolves URLs that work in both Node (file URLs) and browser/bundler contexts once the package is built.

## Building

Artifacts are copied from `libs/quickjs-wasm-build/dist` into this package during build:

```bash
pnpm nx build quickjs-wasm-build   # produce quickjs-eval.{js,wasm} + metadata
pnpm nx build quickjs-wasm         # package into dist/wasm
```

## Tests

```bash
pnpm nx test quickjs-wasm
```
