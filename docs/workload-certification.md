# Workload Certification Report

This document defines the workload-certification evidence flow for the RC
ecosystem phase.

## What is certified

1. **Flagship workload**: deterministic knowledge/compliance pack processing
   (`apps/ecosystem-certifier/fixtures/flagship/knowledge-pack-entry.ts`).
2. **Compatibility matrix**: broad green/red third-party corpus executed via
   `apps/ecosystem-certifier`.
3. **Consensus parity**: strict wasm-node vs wasm-browser comparison for
   value/error, gas, tape, and expected failure stage.
4. **Builder path determinism**: hash equality checks from distinct absolute
   working directories.
5. **Downstream tarball consumer proof**:
   `e2e/consumer-proof-app` installs packed `@blue-quickjs/*` tarballs and
   validates node/browser parity plus exact OOG boundaries.

## Commands

From repo root:

```bash
# Ecosystem certifier tests
source tools/emsdk/emsdk_env.sh
pnpm nx test ecosystem-certifier
pnpm nx run ecosystem-certifier:e2e

# Builder path determinism + workload matrix report
node apps/ecosystem-certifier/scripts/check-builder-determinism.mjs --out-dir artifacts/workload-certification
node tools/workload-certification/compare-builder-determinism-matrix.mjs --input-dir artifacts
node apps/ecosystem-certifier/scripts/archive-workload-certification-report.mjs --out-dir artifacts/workload-certification
node apps/ecosystem-certifier/scripts/run-oog-boundary-certification.mjs --out-dir artifacts/workload-certification
node apps/ecosystem-certifier/scripts/run-repeatability-certification.mjs --out-dir artifacts/workload-certification --iterations 50 --flagship-iterations 20
node apps/ecosystem-certifier/scripts/run-seeded-property-corpus.mjs --out-dir artifacts/workload-certification --seed-count 40

# Downstream tarball consumer proof
node tools/workload-certification/pack-public-tarballs.mjs --out-dir artifacts/consumer-proof/tarballs
pnpm --dir e2e/consumer-proof-app run install:tarballs -- --tarball-dir ../../artifacts/consumer-proof/tarballs
pnpm --dir e2e/consumer-proof-app run repro
```

## Expected artifact outputs

- `artifacts/workload-certification/builder-determinism-report.json`
- `artifacts/workload-certification/workload-certification-<timestamp>.json`
- `artifacts/workload-certification/workload-certification-<timestamp>.md`
- `artifacts/workload-certification/workload-certification-<timestamp>.json.sha256`
- `artifacts/workload-certification/compatibility-matrix-<timestamp>.json`
- `artifacts/workload-certification/oog-boundaries.json`
- `artifacts/workload-certification/repeatability-report.json`
- `artifacts/workload-certification/seeded-property-corpus-report.json`
- `e2e/consumer-proof-app/reports/reproducibility-report.json`
- `e2e/consumer-proof-app/reports/oog-boundary.json`

The workload-certification JSON includes:

- summary counts (`greenCount`, `redCount`, `mismatches`, `flagshipCount`),
- a machine-readable `compatibilityMatrix`,
- full per-fixture node/browser snapshots with gas and tape hashes,
- signature digest (`sha256`) over canonical report payload.

## Policy notes

- Consensus remains **wasm-node vs wasm-browser**.
- Native harness remains diagnostic-only.
- Failures are documented as deterministic incompatibilities instead of widening
  deterministic contracts.
