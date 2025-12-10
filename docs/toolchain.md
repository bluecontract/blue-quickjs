# Toolchain — Emscripten/emsdk

Deterministic Wasm builds rely on a pinned Emscripten toolchain. We vendor `emsdk` locally under `tools/emsdk` and lock the version in `tools/scripts/emsdk-version.txt`.

## Pinned version
- Emscripten/emsdk: `3.1.56` (see `tools/scripts/emsdk-version.txt`).
- Install location: `tools/emsdk` (ignored from commits).

## Local setup
1) From repo root: `tools/scripts/setup-emsdk.sh`  
   - Clones `emsdk` into `tools/emsdk` if missing.  
   - Installs + activates the pinned version.
2) Load env into your shell for the session: `source tools/emsdk/emsdk_env.sh`.
3) Verify: `emcc --version` should report `3.1.56`.

Notes:
- Script is idempotent; rerun after pulling a new pinned version.
- Keep `emsdk` network access unblocked during install.

## CI caching
- Cache the `tools/emsdk` directory keyed by the contents of `tools/scripts/emsdk-version.txt`.
- CI step order:
  1) Restore `tools/emsdk` cache (if any).
  2) Run `tools/scripts/setup-emsdk.sh` to ensure the pinned version is present.
  3) `source tools/emsdk/emsdk_env.sh` before build steps.

## Usage reminders
- Nx targets that compile QuickJS to Wasm should depend on `emcc` from the sourced env, not a system install.
- If multiple shells are used, each shell must source `emsdk_env.sh` before invoking build scripts.
