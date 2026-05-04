# Release Checklist

Scope: steps to publish deterministic engine + ABI packages.

## Preflight

- Confirm the working tree is clean and `vendor/quickjs` is pinned to the intended commit.
- Run `pnpm lint`, `pnpm nx typecheck`, `pnpm nx test`, and `pnpm nx build`.
- Confirm release-facing docs still state the consensus-safe scope correctly:
  - `wasm-node` vs `wasm-browser`
  - canonical `wasm32` release engine
  - native remains diagnostic-only
- Run strict parity gating for consensus executors (`wasm-node` vs
  `wasm-browser`) with raw gas equality (no gas-delta baseline normalization).
- Verify gas schedule docs are synchronized with the canonical spec source:
  - `pnpm gas-spec:test`
  - `node tools/gas-spec/render-gas-artifacts.mjs --check`
- Enforce critical package coverage thresholds. The current accepted minimum is
  40% for lines, branches, functions, and statements across
  `quickjs-runtime`, `deterministic-bundler`, `deterministic-builder`,
  `abi-manifest`, `blue-quickjs-cli`, and `ecosystem-certifier`.
  - `pnpm test:coverage:critical`
- Verify OOG boundary parity checks are green for the consensus fixture corpus.
  - `pnpm nx test test-harness` (includes wasm/native boundary search fixtures in
    `libs/test-harness/src/lib/gas-equivalence.spec.ts`).
  - `pnpm nx run smoke-web:e2e` (includes browser/node boundary parity in
    `apps/smoke-web/tests/gas-boundaries.spec.ts`).
- Archive reproducibility report artifacts for the release candidate:
  - Consensus release gate reports (wasm-node vs wasm-browser) are required.
    - `node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs --out-dir artifacts/reproducibility-consensus/chromium --browser chromium`
    - `node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs --out-dir artifacts/reproducibility-consensus/firefox --browser firefox`
  - Native report generation is diagnostic by default:
    - `node tools/quickjs-native-harness/scripts/archive-reproducibility-report.mjs`
  - If native is explicitly promoted to a consensus executor for this release,
    require strict native report generation:
    - `node tools/quickjs-native-harness/scripts/archive-reproducibility-report.mjs --strict`
  - Preserve both generated report JSON and matching `.sha256` sidecars.
- Run workload/ecosystem certification reports:
  - `node apps/ecosystem-certifier/scripts/check-builder-determinism.mjs --out-dir artifacts/workload-certification`
  - `node tools/workload-certification/compare-builder-determinism-matrix.mjs --input-dir artifacts`
  - `node apps/ecosystem-certifier/scripts/archive-workload-certification-report.mjs --out-dir artifacts/workload-certification`
  - `node apps/ecosystem-certifier/scripts/generate-compatibility-delta-report.mjs --current-dir artifacts/workload-certification --out-dir artifacts/workload-certification`
  - `node apps/ecosystem-certifier/scripts/run-oog-boundary-certification.mjs --out-dir artifacts/workload-certification`
  - `node apps/ecosystem-certifier/scripts/run-repeatability-certification.mjs --out-dir artifacts/workload-certification --iterations 100 --flagship-iterations 40`
  - `node apps/ecosystem-certifier/scripts/run-seeded-property-corpus.mjs --out-dir artifacts/workload-certification --seed-count 80`
- Run downstream tarball consumer reproducibility proof:
  - Version alignment + pack manifest checks:
    - `pnpm workload:check-public-package-versions`
    - `pnpm workload:check-pack-manifests -- --out-dir artifacts/consumer-proof/pack-manifests`
  - Primary registry-style rehearsal:
    - `pnpm publish-rehearsal:verdaccio -- --out-dir artifacts/consumer-proof/verdaccio`
  - Secondary tarball rehearsal:
  - `node tools/workload-certification/pack-public-tarballs.mjs --out-dir artifacts/consumer-proof/tarballs`
  - `pnpm --dir e2e/consumer-proof-app run install:tarballs -- --tarball-dir ../../artifacts/consumer-proof/tarballs`
  - `pnpm --dir e2e/consumer-proof-app exec playwright install --with-deps chromium`
  - `pnpm --dir e2e/consumer-proof-app run repro`
- Synthesize release evidence bundle (manifest + summaries + checksums + signatures):
  - `pnpm release-evidence:synthesize -- --out-dir artifacts/release-evidence`
- Verify release evidence bundle locally (auditor command):
  - `pnpm release-evidence:verify -- --evidence-dir artifacts/release-evidence`
- Confirm the release evidence manifest exists and is complete:
  - `artifacts/release-evidence/release-evidence-manifest.json`
- Generate security/supply-chain artifacts:
  - `pnpm release-evidence:sbom -- --out-dir artifacts/security`
  - `pnpm release-evidence:licenses -- --out-dir artifacts/security`
- Refresh playground generated data and ensure it is not stale:
  - `node apps/bluequickjs-playground/scripts/generate-playground-data.mjs`
  - `node apps/bluequickjs-playground/scripts/generate-playground-data.mjs --check`

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

## Reference docs

- [Release-readiness report](./release-readiness-report.md)
- [Production embedder checklist](./production-embedder-checklist.md)
- [Playground](./playground.md)
