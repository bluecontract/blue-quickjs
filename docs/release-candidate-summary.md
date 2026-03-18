# Release-candidate summary (wasm consensus platform)

Date: 2026-03-18  
Branch: `cursor/next-generation-quickjs-platform-1578-rc-f838`

## Consensus-safe today

- `wasm-node` + `wasm-browser` on pinned canonical `wasm32` artifacts.
- Release gate requires:
  - exact result/error/tape parity,
  - exact gas parity,
  - exact OOG boundary parity.

## Diagnostic-only today

- Native harness parity/report path is diagnostic-only by default.
- Native is not consensus-safe unless explicitly promoted with strict parity
  and OOG-boundary evidence under release policy.

## Exact example matrix

| # | Example category | Execution profile | Fixture evidence key |
| --- | --- | --- | --- |
| 1 | Basic deterministic script | `baseline-v1` | `gas-sample:return-1` |
| 2 | Standard module-pack | `baseline-v1` | `module-pack:module-pack-default-export` |
| 3 | Library reuse (`chess.js`, `base64-js`) | `compat-general-v1`, `compat-binary-v1` | `chess-library:chess-e2e6`, `binary-library:base64-js-roundtrip` |
| 4 | Promises / async / microtasks | `compat-general-v1` | `determinism:async-promise-chain` |
| 5 | Promise + imported lib + host call | `compat-general-v1` | `module-pack:module-pack-async-import-host-call` |
| 6 | Binary typed arrays + Host.v2 DV2 | `compat-binary-v1` | `determinism:compat-binary-host-v2-bytes-roundtrip` |
| 7 | Console shim | `compat-general-v1` | `determinism:compat-console-shim` |
| 8 | Stable sort | `compat-general-v1` | `determinism:compat-stable-sort` |
| 9 | Kitchen sink app | `compat-general-v1` | `module-pack:module-pack-kitchen-sink` |
| 10 | Max-gas / DoS boundary | `baseline-v1` | `gas-boundary:loop-10k` |

Detailed deterministic rationale and gas/OOG evidence are maintained in
`examples/README.md`.

## Strict parity evidence location

- Consensus report JSON:
  - `artifacts/reproducibility-consensus-final/consensus-parity-report-2026-03-18T13-14-00-821Z.json`
- Consensus summary artifact:
  - `artifacts/reproducibility-consensus-final/consensus-parity-summary-2026-03-18T13-14-00-821Z.md`
- Report signature digest:
  - `004745efc2e1693f9e334ede433772bd2b5e14cb3d34c98c782ae849211a1522`
- Report file sha256:
  - `248fee4027a055cbc839cf561b578ec8c2efb1ba23d74357472661da8c4ed49f`
- OOG parity status:
  - `exact-parity`

## Remaining known limitations

- Consensus contract currently covers wasm-node/wasm-browser only.
- Native parity remains diagnostic unless explicitly certified.
- Max-gas policy validity depends on pinned
  `engineBuildHash` + `gasVersion` + `executionProfile` + ABI pins.
