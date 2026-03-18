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
  `artifacts/reproducibility-consensus-dev/consensus-parity-report-2026-03-18T13-05-16-272Z.json`
- report checksum:
  `artifacts/reproducibility-consensus-dev/consensus-parity-report-2026-03-18T13-05-16-272Z.json.sha256`
- human summary:
  `artifacts/reproducibility-consensus-dev/consensus-parity-summary-2026-03-18T13-05-16-272Z.md`
- summary checksum:
  `artifacts/reproducibility-consensus-dev/consensus-parity-summary-2026-03-18T13-05-16-272Z.md.sha256`
- signature digest:
  `98a96fecb8dc95545a4c023393930ee4d90f0be126b1e420cb7987cfd3b83406`
- file sha256:
  `e3f2d104ae2e18fcab3664330157a109c0251299472d1e1bc520a1c020027fe5`
- mismatch count: `0`
- OOG boundary parity: `exact-parity`
- executionProfile coverage:
  `baseline-v1, compat-general-v1, compat-binary-v1`

Native diagnostic report:

- path:
  `artifacts/reproducibility-native-final/parity-report-2026-03-17T00-06-48-349Z.json`
- signature digest:
  `412804756c6b7e109f4c4184976e26fd4226a67e4b000451f1e2362c54b2c95d`
- file sha256:
  `05dc3d210e71587a850ec918bc72b7233732d2df9f36aeff82da6c918c9f1a48`

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
