# 06 — Gas, OOG, and max-gas policies

In BlueQuickjs, gas is not an approximate UI metric. It is part of the
deterministic execution contract, and the exact OOG boundary is a release gate
for consensus-safe executors.

## Prerequisites

- Pinned Emscripten environment loaded:

  ```bash
  source tools/emsdk/emsdk_env.sh
  ```

- Playwright Chromium installed

## Commands

Generate the workload OOG-boundary report and inspect the canonical loop
fixture:

```bash
pnpm exec playwright install --with-deps chromium
node apps/ecosystem-certifier/scripts/run-oog-boundary-certification.mjs \
  --out-dir artifacts/workload-certification \
  --browser chromium
rg "loop-10k|firstSuccessGas|lastFailureGas|failureCode" \
  artifacts/workload-certification/oog-boundaries.json -n
```

## Expected output

You should see entries for `loop-10k` including:

- `firstSuccessGas`
- `lastFailureGas`
- failure code information (for example `OOG`)

The important property is not just “fails when gas is low” but that the
boundary is **exact and reproducible**.

## What you learned

- Gas values are deterministic release evidence, not advisory counters.
- The exact success/failure boundary is part of the consensus contract.
- Max-gas policy should be treated as a pinned operational rule, not a fuzzy
  runtime heuristic.

## Continue

Next: [07 — Verify release evidence](./07-verify-release-evidence.md)

## Troubleshooting

- If the boundary script fails, confirm `pnpm nx run ecosystem-certifier:e2e`
  is green first.
- If you want the full gas specification, read [Gas schedule](../gas-schedule.md).
- If you want a human summary of current release evidence, read
  [Release-readiness report](../release-readiness-report.md).
