# ecosystem-certifier

Workload and ecosystem certification app for deterministic `blue-quickjs`.

## What it runs

- Flagship knowledge/compliance pack workload.
- Positive third-party compatibility fixtures.
- Negative deterministic-boundary fixtures.
- Node vs browser parity comparisons (result/error, gas, tape).

## Commands

- Unit tests: `pnpm nx test ecosystem-certifier`
- Browser e2e: `pnpm nx run ecosystem-certifier:e2e`
- Generate certification report:
  `pnpm nx run ecosystem-certifier:certify -- --out-dir artifacts/workload-certification --browser chromium`
- Builder path-determinism check:
  `node apps/ecosystem-certifier/scripts/check-builder-determinism.mjs`
- OOG boundary parity report:
  `node apps/ecosystem-certifier/scripts/run-oog-boundary-certification.mjs --out-dir artifacts/workload-certification --browser chromium`
- Repeatability / soak report:
  `node apps/ecosystem-certifier/scripts/run-repeatability-certification.mjs --out-dir artifacts/workload-certification --iterations 100 --flagship-iterations 40 --browser chromium`
- Seeded property corpus parity report:
  `node apps/ecosystem-certifier/scripts/run-seeded-property-corpus.mjs --out-dir artifacts/workload-certification --seed-count 80 --browser chromium`
- Compatibility delta report:
  `node apps/ecosystem-certifier/scripts/generate-compatibility-delta-report.mjs --current-dir artifacts/workload-certification --out-dir artifacts/workload-certification`
- Regenerate deterministic stress corpus:
  `node apps/ecosystem-certifier/scripts/generate-stress-corpus.mjs`
