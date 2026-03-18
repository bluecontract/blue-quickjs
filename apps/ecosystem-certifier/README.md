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
  `pnpm nx run ecosystem-certifier:certify -- --out-dir artifacts/workload-certification`
- Builder path-determinism check:
  `node apps/ecosystem-certifier/scripts/check-builder-determinism.mjs`
- OOG boundary parity report:
  `node apps/ecosystem-certifier/scripts/run-oog-boundary-certification.mjs --out-dir artifacts/workload-certification`
- Repeatability / soak report:
  `node apps/ecosystem-certifier/scripts/run-repeatability-certification.mjs --out-dir artifacts/workload-certification --iterations 50 --flagship-iterations 20`
- Seeded property corpus parity report:
  `node apps/ecosystem-certifier/scripts/run-seeded-property-corpus.mjs --out-dir artifacts/workload-certification --seed-count 40`
- Regenerate deterministic stress corpus:
  `node apps/ecosystem-certifier/scripts/generate-stress-corpus.mjs`
