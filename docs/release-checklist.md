# Release Checklist

Scope: steps to publish deterministic engine + ABI packages.

## Preflight

- Confirm the working tree is clean and `vendor/quickjs` is pinned to the intended commit.
- Run `pnpm lint`, `pnpm nx typecheck`, `pnpm nx test`, and `pnpm nx build`.
- Run strict parity gating for consensus executors (`wasm-node` vs
  `wasm-browser`) with raw gas equality (no gas-delta baseline normalization).
- Verify gas schedule docs are synchronized with the canonical spec source:
  - `node tools/gas-spec/render-gas-artifacts.mjs --check`
- Verify OOG boundary parity checks are green for the consensus fixture corpus.
  - `pnpm nx test test-harness` (includes wasm/native boundary search fixtures in
    `libs/test-harness/src/lib/gas-equivalence.spec.ts`).
  - `pnpm nx run smoke-web:e2e` (includes browser/node boundary parity in
    `apps/smoke-web/tests/gas-boundaries.spec.ts`).
- Archive reproducibility report artifacts for the release candidate:
  - Consensus release gate reports (wasm-node vs wasm-browser) are required.
    - `node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs`
  - Native report generation is diagnostic by default:
    - `node tools/quickjs-native-harness/scripts/archive-reproducibility-report.mjs`
  - If native is explicitly promoted to a consensus executor for this release,
    require strict native report generation:
    - `node tools/quickjs-native-harness/scripts/archive-reproducibility-report.mjs --strict`
  - Preserve both generated report JSON and matching `.sha256` sidecars.

## Wasm build + metadata

- Run `pnpm nx build quickjs-wasm-build`.
- Verify `libs/quickjs-wasm-build/dist/quickjs-wasm-build.metadata.json`:
  - `engineBuildHash` is present.
  - `gasVersion` is present and matches the release gas schedule.
  - `variants.wasm32.release.engineBuildHash` matches `sha256` of `quickjs-eval.wasm`.
- Run `pnpm nx build quickjs-wasm` and confirm `libs/quickjs-wasm/dist/wasm` contains
  wasm, loader, and metadata assets.

## Parity policy checks

- Confirm release workflows do **not** depend on
  `tools/quickjs-native-harness/scripts/parity-gas-delta-baseline.json`.
- Diagnostic parity deltas may be retained for investigation workflows, but they
  must not be part of release acceptance.

## Manifest + fixtures

- If the manifest changed:
  - Re-encode + hash with `@blue-quickjs/abi-manifest`.
  - Update `libs/test-harness/fixtures/abi-manifest/*`, the public `HOST_V1_*` exports in `libs/abi-manifest/src/lib/host-v1-manifest.ts`, and any tests that pin `HOST_V1_HASH`.

## Versioning

- Choose the semver bump per `docs/release-policy.md`.
- Update versions in:
  - `libs/dv/package.json`
  - `libs/abi-manifest/package.json`
  - `libs/quickjs-wasm-constants/package.json`
  - `libs/quickjs-wasm/package.json`
  - `libs/quickjs-runtime/package.json`

## Publish

- Publish the five packages from their package roots after build (dist/ is included in `files`).
- Tag the release and record the engine build hash + manifest hash in the release notes.
