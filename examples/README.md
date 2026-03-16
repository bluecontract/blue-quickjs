# Deterministic examples corpus

This corpus maps product-facing deterministic examples to runnable fixture
coverage already exercised by `smoke-node`, `smoke-web`, and the consensus
reproducibility report pipeline.

## Run once (build + parity evidence)

```bash
source tools/emsdk/emsdk_env.sh
pnpm nx test smoke-node
pnpm nx run smoke-web:e2e
node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs \
  --out-dir artifacts/reproducibility-consensus
```

Native diagnostic parity evidence (optional, non-consensus):

```bash
pnpm nx build quickjs-native-harness
pnpm nx test quickjs-native-harness
node tools/quickjs-native-harness/scripts/archive-reproducibility-report.mjs
```

## Example matrix

All examples below are executable through the commands above. The consensus
report (`artifacts/reproducibility-consensus/*.json`) contains exact result,
gas used/remaining, tape parity, and OOG-boundary parity fields for mapped
fixtures.

| Example | Scenario | Profile | Source fixtures / files |
|---|---|---|---|
| 1 | Basic deterministic script | `baseline-v1` | `libs/test-harness/src/lib/gas-fixtures.ts` → `return-1` |
| 2 | Static ESM module-pack | `baseline-v1` | `libs/test-harness/src/lib/module-pack-fixtures.ts` → `module-pack-default-export`, `module-pack-named-export` |
| 3 | Real npm library reuse | `compat-general-v1`, `compat-binary-v1` | `libs/test-harness/fixtures/library-reuse/chess-entry.ts`, `binary-base64-entry.ts`, `binary-sha256-entry.ts` |
| 4 | Promises + async/await + queueMicrotask | `compat-general-v1` | `libs/test-harness/src/lib/determinism-fixtures.ts` → `async-promise-chain`, `async-queue-microtask-host`, `async-promise-rejection` |
| 5 | Promises + imported library + host call | `compat-general-v1` | `libs/test-harness/src/lib/module-pack-fixtures.ts` → `module-pack-async-import-host-call` |
| 6 | Binary / typed-array + Host.v2/DV2 | `compat-binary-v1` | `libs/test-harness/src/lib/determinism-fixtures.ts` → `compat-binary-host-v2-bytes-roundtrip`; binary library fixtures above |
| 7 | Console shim determinism | `compat-general-v1` | `libs/test-harness/src/lib/determinism-fixtures.ts` → `compat-console-shim` |
| 8 | Stable sort determinism | `compat-general-v1` | `libs/test-harness/src/lib/determinism-fixtures.ts` → `compat-stable-sort` |
| 9 | Kitchen sink app path | `compat-general-v1` | `libs/test-harness/src/lib/module-pack-fixtures.ts` → `module-pack-kitchen-sink` |
| 10 | Max-gas / DoS boundary policy | `baseline-v1` | `apps/smoke-web/tests/gas-boundaries.spec.ts` + `GAS_SAMPLE_FIXTURES` boundary subset |

## Reading exact gas / boundary values

- Consensus executor parity report:
  - `node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs`
- Report includes:
  - `metadata.engineBuildHash`
  - `metadata.gasVersion`
  - per-fixture `gasUsed`, `gasRemaining`
  - per-boundary fixture `firstSuccessGas` and `lastFailureGas`
  - mismatch counters for wasm-node vs wasm-browser.

For release, treat wasm-node/wasm-browser report as normative consensus
evidence and native reports as diagnostic unless explicitly promoted by policy.
