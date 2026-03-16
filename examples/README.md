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

Canonical source snippets for each category live under `examples/0*/`.
Exact parity values come from the consensus report (`wasm-node` vs
`wasm-browser`).

Consensus metadata snapshot (from latest local report run):

- `engineBuildHash`: `f91091cb7feb788df340305a877a9cadb0c6f4d13aea8a7da4040b6367d178ea`
- `gasVersion`: `8`
- `executionProfile`: fixture-defined per example

| # | Scenario | Profile | Source file(s) | Fixture key(s) | Expected result / gas evidence |
|---|---|---|---|---|---|
| 1 | Basic deterministic script | `baseline-v1` | `examples/01-basic-script/program.js` | `gas-sample-fixtures:return-1` | `resultHash=4bf5…459a`, `gasUsed=74`, `gasRemaining=999926` |
| 2 | Standard ESM module-pack | `baseline-v1` | `examples/02-module-pack/entry.js`, `examples/02-module-pack/values.js` | `module-pack-fixtures:module-pack-default-export` | `ok=true`, `valueHash=ca35…e879`, `gasUsed=204`, `gasRemaining=49796` |
| 3 | Real npm library reuse (`chess.js` + `base64-js`) | `compat-general-v1`, `compat-binary-v1` | `examples/03-library-reuse/chess-entry.ts`, `examples/03-library-reuse/binary-base64-entry.ts` | `chess-library:chess-e2e6`, `binary-library:base64-js-roundtrip` | chess: `value=false`, `gasUsed=2070610`; base64: `value.sum=36`, `gasUsed=3542` |
| 4 | Promises / async / microtasks | `compat-general-v1` | `examples/04-promises-async/program.js` | `determinism-fixtures:async-promise-chain` | `resultHash=7f83…5c53`, `gasUsed=128`, `gasRemaining=49872` |
| 5 | Promises + imported lib + host call | `compat-general-v1` | `examples/05-promises-library-host/entry.js`, `examples/05-promises-library-host/lib.js` | `module-pack-fixtures:module-pack-async-import-host-call` | `valueHash=7f83…5c53`, `tapeLength=1`, `gasUsed=345`, `gasRemaining=49655` |
| 6 | Binary / typed arrays / Host.v2 DV2 | `compat-binary-v1` | `examples/06-binary-host-v2/program.js` | `determinism-fixtures:compat-binary-host-v2-bytes-roundtrip` | `resultHash=a538…b2f8`, `tapeLength=2`, `gasUsed=253`, `gasRemaining=49747` |
| 7 | Console shim determinism | `compat-general-v1` | `examples/07-console-shim/program.js` | `determinism-fixtures:compat-console-shim` | `resultHash=20a9…cd02`, `tapeLength=1`, `gasUsed=139`, `gasRemaining=49861` |
| 8 | Stable sort determinism | `compat-general-v1` | `examples/08-stable-sort/program.js` | `determinism-fixtures:compat-stable-sort` | `resultHash=950f…3c04`, `gasUsed=1020`, `gasRemaining=48980` |
| 9 | Kitchen sink app | `compat-general-v1` | `examples/09-kitchen-sink/entry.js`, `examples/09-kitchen-sink/workflow.js` | `module-pack-fixtures:module-pack-kitchen-sink` | `valueHash=81c4…ee75`, `tapeLength=3`, `gasUsed=1444`, `gasRemaining=48556` |
| 10 | Max-gas / DoS boundary policy | `baseline-v1` | `examples/10-max-gas-policy/program.js` | `gas-boundary-fixtures:loop-10k` | success at `N=170099`, fail at `N-1=170098`, both `gasRemaining=0`, fail code `OOG` |

### Per-example build/run validation commands

All examples are validated by fixture-driven parity tests:

```bash
source tools/emsdk/emsdk_env.sh
pnpm nx test smoke-node
pnpm nx run smoke-web:e2e
node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs \
  --out-dir artifacts/reproducibility-consensus
```

For native diagnostic comparison (non-consensus):

```bash
pnpm nx build quickjs-native-harness
pnpm nx test quickjs-native-harness
node tools/quickjs-native-harness/scripts/archive-reproducibility-report.mjs
```

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
