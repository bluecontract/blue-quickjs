# Release-readiness report (current branch snapshot)

Date: 2026-03-16  
Branch: `cursor/next-generation-quickjs-platform-1578`

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
  - `total mismatches: 0`.

### Diagnostic-only

- Native harness parity/report path remains diagnostic by default.
- Native strict mode is available (`--strict`) but not required for consensus
  acceptance unless policy explicitly promotes native to consensus.

## Evidence artifacts from latest validation run

Consensus report:

- path:
  `artifacts/reproducibility-consensus-final/consensus-parity-report-2026-03-16T23-57-34-872Z.json`
- signature digest:
  `11fba081413603bdb3d1b57b291c9247bd2bf9b0176736210d1909a066bfc5b2`
- file sha256:
  `d34f691fdeff4e09b1e5a58a981c6c97784425dcba1c76bc07084bd44aa31adc`
- mismatch count: `0`

Native diagnostic report:

- path:
  `artifacts/reproducibility-native-final/parity-report-2026-03-16T23-57-39-057Z.json`
- signature digest:
  `cba6049b318674eecbc4176d24ed8622bea96fedb307c8ae38563988689e9a30`
- file sha256:
  `3e8c449b4f510f7d3b591b6025b2c67147b969fefde9904ccb6512002196c3f2`

## Validation commands executed

```bash
source tools/emsdk/emsdk_env.sh
pnpm nx run-many -t lint -p deterministic-bundler,test-harness,smoke-node,blue-quickjs-cli,quickjs-native-harness
pnpm nx run-many -t typecheck,test -p deterministic-bundler,quickjs-runtime,test-harness,smoke-node,blue-quickjs-cli,quickjs-native-harness
pnpm nx run smoke-web:e2e
node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs --out-dir artifacts/reproducibility-consensus-final
node tools/quickjs-native-harness/scripts/archive-reproducibility-report.mjs --out-dir artifacts/reproducibility-native-final
```

## Example corpus status

- `examples/` now contains standalone source files for all 10 required example
  categories.
- Example-to-fixture mapping and expected gas/OOG evidence are documented in
  `examples/README.md`.
- Coverage guard: `apps/smoke-node/src/lib/examples-corpus.spec.ts`.
