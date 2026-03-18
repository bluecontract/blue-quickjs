# HEAD verification note

This note summarizes what to verify at repository HEAD before treating a branch
as release-candidate evidence-complete.

## What must be true

1. Consensus release contract remains `wasm-node` vs `wasm-browser` with exact:
   - result/error parity,
   - gas parity,
   - host-tape parity,
   - OOG boundary parity.
2. Native harness remains diagnostic-only unless explicitly promoted by release
   policy.
3. Program/profile/pinning story is consistent across docs:
   - `baseline-v1`, `compat-general-v1`, `compat-binary-v1`,
   - `engineBuildHash`, `gasVersion`, and ABI manifest hash pinning.

## Quick verification commands

```bash
source tools/emsdk/emsdk_env.sh
pnpm nx test smoke-node
pnpm nx run smoke-web:e2e
pnpm nx test ecosystem-certifier
pnpm nx run ecosystem-certifier:e2e
node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs --out-dir artifacts/reproducibility-consensus
node apps/ecosystem-certifier/scripts/archive-workload-certification-report.mjs --out-dir artifacts/workload-certification
```

## Linked snapshots and reports

- Current implementation snapshot:
  [`implementation-summary.md`](./implementation-summary.md)
- Release readiness summary:
  [`release-readiness-report.md`](./release-readiness-report.md)
- Workload certification:
  [`workload-certification.md`](./workload-certification.md)
- Ecosystem compatibility:
  [`ecosystem-compatibility-report.md`](./ecosystem-compatibility-report.md)
