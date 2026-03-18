# Release-readiness report (current branch snapshot)

Date: 2026-03-18  
Branch: `cursor/wasm-consensus-ga-readiness-51ed`

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

## Evidence artifacts from latest available validation run

Consensus report:

- path:
  `artifacts/reproducibility-consensus-final/consensus-parity-report-2026-03-17T00-06-43-895Z.json`
- signature digest:
  `93e8ff7691373861695ab1b2a45c7e881340aff26a187405b346561b8f8a96e1`
- file sha256:
  `c695a4792ccf820483ace64fb0ef263ca5115f4cf339185ecc693a15ad7ca025`
- mismatch count: `0`

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
