# Toolchain — Emscripten/emsdk

Deterministic Wasm builds rely on a pinned Emscripten toolchain. We vendor `emsdk` locally under `tools/emsdk` and lock the version in `tools/scripts/emsdk-version.txt`.

Baseline anchors: see `docs/baseline-1.md` (deterministic execution constraints) and `docs/baseline-2.md` (host ABI contract that must be consistent across environments).

## Pinned version

- Emscripten/emsdk: `3.1.56` (see `tools/scripts/emsdk-version.txt`).
- Install location: `tools/emsdk` (ignored from commits).

## Local setup

1. From repo root: `tools/scripts/setup-emsdk.sh`
   - Clones `emsdk` into `tools/emsdk` if missing.
   - Installs + activates the pinned version.
2. Ensure the generated QuickJS source tree is prepared:

   ```bash
   bash tools/scripts/prepare-quickjs-source.sh
   ```

   The repo now auto-runs this check before native-harness and wasm builds, but
   it is still useful as an explicit recovery step on fresh clones.
3. Load env into your shell for the session: `source tools/emsdk/emsdk_env.sh`.
4. Verify: `emcc --version` should report `3.1.56`.

Notes:

- Script is idempotent; rerun after pulling a new pinned version.
- Keep `emsdk` network access unblocked during install.
- On macOS, the setup script now retries once automatically, clears quarantine
  attributes if possible, and on Apple Silicon retries the install with
  `EMSDK_ARCH=x86_64` as a fallback. If that fallback path succeeds, Rosetta may
  be required:

  ```bash
  softwareupdate --install-rosetta --agree-to-license
  ```

- The setup script now prefers the host `python3`/`python` to run `emsdk.py`
  directly, which avoids macOS repeatedly re-entering a partially installed
  bundled Python during retries.
- On macOS specifically, the script prefers `/usr/bin/python3` over Conda or
  other shimmed interpreters and clears `PYTHONHOME`, `PYTHONPATH`, and common
  `CONDA_*` variables before invoking `emsdk.py`.

## CI caching

- Cache the `tools/emsdk` directory keyed by the contents of `tools/scripts/emsdk-version.txt`.
- CI step order:
  1. Restore `tools/emsdk` cache (if any).
  2. Run `tools/scripts/setup-emsdk.sh` to ensure the pinned version is present.
  3. `source tools/emsdk/emsdk_env.sh` before build steps.

## Usage reminders

- Nx targets that compile QuickJS to Wasm should depend on `emcc` from the sourced env, not a system install.
- If multiple shells are used, each shell must source `emsdk_env.sh` before invoking build scripts.

## Deterministic Wasm build settings

- `libs/quickjs-wasm-build/scripts/build-wasm.sh` sets `SOURCE_DATE_EPOCH=1704067200` (override by exporting your own). We intentionally avoid `-sDETERMINISTIC` because it patches host `Date.now`/`Math.random`.
- Memory is fixed: `-sINITIAL_MEMORY=33554432` and `-sMAXIMUM_MEMORY=33554432` with `-sALLOW_MEMORY_GROWTH=0`, a 1 MiB stack, and `-sALLOW_TABLE_GROWTH=0`.
- Host surface only: the Emscripten filesystem is stripped (`-sFILESYSTEM=0`), and the environment is limited to `node,web` with `-sNO_EXIT_RUNTIME=1`; no FS/network syscalls are available to the wasm module.
- Built artifacts record these settings in `dist/quickjs-wasm-build.metadata.json` under `build.memory` and `build.determinism` for auditability.
- By default the build emits both release and debug wasm32 artifacts; set `WASM_BUILD_TYPES=release` to skip debug. Debug builds add Emscripten assertions/stack-overflow checks while keeping the same deterministic VM semantics.

## QuickJS wasm build outputs

- Artifacts land in `libs/quickjs-wasm-build/dist/` as `quickjs-eval{,-debug}{,-wasm64}.{js,wasm}` (wasm32 is canonical; wasm64 is optional for debugging). Loader + metadata are resolved via `getQuickjsWasmArtifacts(...)` and `readQuickjsWasmMetadata()`.
- `quickjs-wasm-build.metadata.json` captures per-variant/per-build-type filenames, hashes, sizes, flags, and `engineBuildHash` (keyed to wasm32 release when present).
- The wasm harness exports deterministic ABI entrypoints only (`qjs_det_init`/`qjs_det_eval`/`qjs_det_set_gas_limit`/`qjs_det_free` plus tape/trace helpers) and returns DV-hex payloads with `RESULT … GAS …` / `ERROR … GAS …` formatting; `qjs_det_init(..., feature_flags)` accepts deterministic feature flags (`0` for baseline), and strings are freed with the exported `_free` helper.
