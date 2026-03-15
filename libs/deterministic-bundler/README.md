# @blue-quickjs/deterministic-bundler

Deterministic build tooling for `blue-quickjs` artifacts.

- `bundleDeterministicProgram(...)` flattens static module graphs into one
  script string for transitional script-mode execution.
- `buildDeterministicModulePack(...)` emits canonical `ModulePack.v1` output,
  compatibility diagnostics, and optional script artifacts.
- Both APIs produce stable SHA-256 hashes and deterministic compatibility scans.

Build/test:

- `pnpm nx build deterministic-bundler`
- `pnpm nx test deterministic-bundler`
