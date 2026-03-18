# Deterministic examples corpus

This corpus is the product-facing proof set for deterministic execution across
the consensus executor matrix (`wasm-node` vs `wasm-browser`).

## Consensus-safe and diagnostic scope

- **Consensus-safe evidence source:** consensus parity report + summary generated
  by `tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs`.
- **Diagnostic-only by default:** native harness (`tools/quickjs-native-harness`)
  unless explicitly promoted by release policy.

## Metadata context used by all examples

From the latest consensus report summary:

- `engineBuildHash`: `f91091cb7feb788df340305a877a9cadb0c6f4d13aea8a7da4040b6367d178ea`
- `gasVersion`: `8`
- execution profiles covered in corpus:
  `baseline-v1`, `compat-general-v1`, `compat-binary-v1`
- total fixtures: `38`
- mismatch count: `0`
- exact OOG boundary parity status: `exact-parity`

## Runbook (generate strict evidence)

```bash
source tools/emsdk/emsdk_env.sh
pnpm nx test smoke-node
pnpm nx run smoke-web:e2e
node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs \
  --out-dir artifacts/reproducibility-consensus
```

Optional native diagnostics (non-consensus):

```bash
pnpm nx build quickjs-native-harness
pnpm nx test quickjs-native-harness
node tools/quickjs-native-harness/scripts/archive-reproducibility-report.mjs
```

## Certified 10-example matrix

| # | Scenario | Profile | Source | Why deterministic | Gas / OOG evidence | Environment coverage |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Basic script | `baseline-v1` | `examples/01-basic-script/program.js` | No ambient APIs; pure script final expression | `gas-sample:return-1` -> `gasUsed=74`, `gasRemaining=999926` | consensus (`wasm-node`,`wasm-browser`) + native diagnostic |
| 2 | Module-pack basics | `baseline-v1` | `examples/02-module-pack/*` | Static in-memory module graph (`ModulePack.v1`), no runtime fetch | `module-pack:module-pack-default-export` -> `gasUsed=204`, `gasRemaining=49796` | consensus + native diagnostic |
| 3 | Imported libraries (`chess.js`, `base64-js`) | `compat-general-v1`, `compat-binary-v1` | `examples/03-library-reuse/*` | Libraries are deterministically built/packaged at build time | chess fixture `gasUsed=2070610`; base64 fixture `gasUsed=3542` | consensus + native diagnostic |
| 4 | Promises / async / microtasks | `compat-general-v1` | `examples/04-promises-async/program.js` | Promise jobs drained deterministically at evaluation boundary | `determinism:async-promise-chain` -> `gasUsed=128`, `gasRemaining=49872` | consensus + native diagnostic |
| 5 | Promise + import + host call | `compat-general-v1` | `examples/05-promises-library-host/*` | Deterministic Promise drain + static module-pack import + manifest-locked host call | `module-pack:module-pack-async-import-host-call` -> `gasUsed=345`, `tapeLength=1` | consensus + native diagnostic |
| 6 | Binary typed arrays + Host.v2 DV2 | `compat-binary-v1` | `examples/06-binary-host-v2/program.js` | Bytes cross boundary via DV2 + Host.v2 canonical encoding | `determinism:compat-binary-host-v2-bytes-roundtrip` -> `gasUsed=253`, `tapeLength=2` | consensus + native diagnostic |
| 7 | Console shim | `compat-general-v1` | `examples/07-console-shim/program.js` | Console routes through deterministic host emit shim | `determinism:compat-console-shim` -> `gasUsed=139`, `tapeLength=1` | consensus + native diagnostic |
| 8 | Stable sort | `compat-general-v1` | `examples/08-stable-sort/program.js` | Compatibility profile enables deterministic stable sort | `determinism:compat-stable-sort` -> `gasUsed=1020`, `gasRemaining=48980` | consensus + native diagnostic |
| 9 | Kitchen sink app | `compat-general-v1` | `examples/09-kitchen-sink/*` | Combines docs reads, async/microtasks, stable sort, emit with deterministic ordering | `module-pack:module-pack-kitchen-sink` -> `gasUsed=1444`, `tapeLength=3` | consensus + native diagnostic |
| 10 | Max-gas DoS policy boundary | `baseline-v1` | `examples/10-max-gas-policy/program.js` | Gas budget and OOG edge checked by binary-search boundary fixture | `gas-boundary:loop-10k` -> success `N=170099`, fail `N-1=170098`, fail=`OOG` | consensus (release-critical) + native diagnostic |

## Deep-dive: required flagship scenarios

### 1) Promises / async / microtasks (`examples/04-promises-async`)

- Promise chain is evaluated in `compat-general-v1`.
- Runtime drains Promise jobs deterministically before returning.
- Gas equality is exact across `wasm-node` and `wasm-browser` (`128` used).

### 2) Imported libraries / module packs (`examples/02-module-pack`, `examples/03-library-reuse`)

- Imports are resolved by deterministic builder/module-pack flow.
- Runtime loads module source from in-memory `ModulePack.v1` only.
- No filesystem/network dynamic module fetch at execution time.

### 3) Promise + imported library + host call (`examples/05-promises-library-host`)

- Module import is static and deterministic.
- Promise resolution and microtask draining occur in deterministic order.
- Host call (`Host.v1.emit`) is manifest-locked; tape parity confirms
  cross-executor host-call transcript equality.

### 4) Binary APIs + Host.v2 DV2 (`examples/06-binary-host-v2`)

- Typed arrays are enabled only in `compat-binary-v1`.
- Bytes cross VM boundary as DV2 byte strings via Host.v2.
- Result hash + host tape + gas are exact between consensus executors.

### 5) Max-gas / DoS boundary (`examples/10-max-gas-policy`)

- Document policy can pin `maxGas = N` where fixture proves:
  - success at `N=170099`,
  - deterministic OOG at `N-1=170098`.
- Boundary is identical in wasm-node and wasm-browser, which is the consensus
  requirement for DoS-control validity.

### 6) Kitchen sink real-app shape (`examples/09-kitchen-sink`)

- Demonstrates deterministic composition of:
  - host document reads,
  - Promise + `queueMicrotask`,
  - stable sort,
  - deterministic host emit tape.
- Same module-pack artifact executes with exact gas/tape parity on both
  consensus executors.

## Where to inspect exact values

Consensus report JSON includes:

- `metadata.engineBuildHash`
- `metadata.gasVersion`
- `metadata.executionProfiles`
- suite/fixture-level gas and tape values
- gas-boundary suite with first-success / last-failure boundaries

Consensus summary markdown includes human-readable release checks:

- mismatch count
- OOG boundary parity status
- signature digest + checksum references
- per-suite mismatch overview
