# quickjs-wasm-build

Early Emscripten build of the deterministic QuickJS fork with gas metering.

## Building

- Ensure the pinned toolchain is installed (`tools/scripts/setup-emsdk.sh`) and `vendor/quickjs` is initialized.
- Run `pnpm nx build quickjs-wasm-build` to compile the wasm harness and emit `quickjs-eval.{js,wasm}` to `libs/quickjs-wasm-build/dist/`. TypeScript outputs also land in this directory.

The ESM loader exports a `QuickJSGasWasm` factory; the harness exports `qjs_eval(code, gasLimit)` and `qjs_free_output(ptr)`.

## Running unit tests

Run `pnpm nx test quickjs-wasm-build` to execute the Vitest suite (path helper assertions).
