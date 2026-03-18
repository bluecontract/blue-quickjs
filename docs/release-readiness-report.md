# Release-readiness report (current branch snapshot)

Date: 2026-03-18  
Branch: `cursor/next-generation-quickjs-platform-1578-rc-f838`

## Environment

- OS: Linux 6.1.147
- Node: from workspace toolchain (`>=20.17.0`)
- pnpm workspace + Nx
- Emscripten: pinned `3.1.56` (`tools/scripts/setup-emsdk.sh`)

## Consensus-safe vs diagnostic-only

### Consensus-safe (release gate)

- Executor pair: `wasm-node` vs `wasm-browser` (`wasm32`, release artifacts).
- Gate requirements:
  - exact result/error parity,
  - exact gas used/remaining parity,
  - exact host-tape parity where applicable,
  - exact OOG boundary parity.
- Current evidence:
  - consensus reproducibility report run with `total fixtures: 38`,
  - `total mismatches: 0`,
  - exact OOG boundary parity status: `exact-parity`.

### Diagnostic-only

- Native harness parity/report path remains diagnostic by default.
- Native strict mode is available (`--strict`) but not required for consensus
  acceptance unless policy explicitly promotes native to consensus.

## Evidence artifacts from latest validation run

Consensus report artifacts:

- report JSON:
  `artifacts/reproducibility-consensus-final/consensus-parity-report-2026-03-18T13-24-15-967Z.json`
- report checksum:
  `artifacts/reproducibility-consensus-final/consensus-parity-report-2026-03-18T13-24-15-967Z.json.sha256`
- report signature sidecar:
  `artifacts/reproducibility-consensus-final/consensus-parity-report-2026-03-18T13-24-15-967Z.json.sig`
- human summary:
  `artifacts/reproducibility-consensus-final/consensus-parity-summary-2026-03-18T13-24-15-967Z.md`
- summary checksum:
  `artifacts/reproducibility-consensus-final/consensus-parity-summary-2026-03-18T13-24-15-967Z.md.sha256`
- summary signature sidecar:
  `artifacts/reproducibility-consensus-final/consensus-parity-summary-2026-03-18T13-24-15-967Z.md.sig`
- signature digest:
  `676fd9cf9a854cbaa823737655450de82a40073db39c159b0a4ecf307934b6a1`
- file sha256:
  `9f390771ea1a94b0a5ec529b7871034bab28338073ed795cc035c72457371054`
- mismatch count: `0`
- OOG boundary parity: `exact-parity`
- executionProfile coverage:
  `baseline-v1, compat-general-v1, compat-binary-v1`

Native diagnostic report:

- path:
  `artifacts/reproducibility-native-final/parity-report-2026-03-18T13-14-16-293Z.json`
- signature digest:
  `24175b7d6b6694c58076cd96f53dae5c63b59aa0e4eb422d235882a89d84ebf2`
- file sha256:
  `8093aca0571cd7102bf6a895e4afff662479728dbccd75d8a24d0a50305f80a8`

## Validation commands executed

```bash
source tools/emsdk/emsdk_env.sh
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm nx build quickjs-wasm-build
pnpm nx test quickjs-runtime
pnpm nx test smoke-node
pnpm nx run smoke-web:e2e
pnpm nx build quickjs-native-harness
pnpm nx test quickjs-native-harness
node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs --out-dir artifacts/reproducibility-consensus-final
node tools/quickjs-native-harness/scripts/archive-reproducibility-report.mjs --out-dir artifacts/reproducibility-native-final
```

## Example corpus status

- `examples/` now contains standalone source files for all 10 required example
  categories.
- Example-to-fixture mapping and expected gas/OOG evidence are documented in
  `examples/README.md`.
- Coverage guard: `apps/smoke-node/src/lib/examples-corpus.spec.ts`.
