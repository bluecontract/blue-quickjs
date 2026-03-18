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
  - `artifacts/reproducibility-consensus-dev/consensus-parity-report-2026-03-18T13-05-16-272Z.json`
- Consensus summary artifact:
  - `artifacts/reproducibility-consensus-dev/consensus-parity-summary-2026-03-18T13-05-16-272Z.md`
- Report signature digest:
  - `98a96fecb8dc95545a4c023393930ee4d90f0be126b1e420cb7987cfd3b83406`
- Report file sha256:
  - `e3f2d104ae2e18fcab3664330157a109c0251299472d1e1bc520a1c020027fe5`
- OOG parity status:
  - `exact-parity`

## Remaining known limitations

- Consensus contract currently covers wasm-node/wasm-browser only.
- Native parity remains diagnostic unless explicitly certified.
- Max-gas policy validity depends on pinned
  `engineBuildHash` + `gasVersion` + `executionProfile` + ABI pins.
