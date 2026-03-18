# First 10 minutes with BlueQuickjs

This guide is for operators/auditors evaluating a release quickly.

## 1) Build and run a deterministic smoke path

```bash
pnpm install
bash tools/scripts/setup-emsdk.sh
source tools/emsdk/emsdk_env.sh
pnpm nx test smoke-node
pnpm nx run smoke-web:e2e
```

## 2) Generate release evidence bundle

```bash
pnpm release-evidence:synthesize -- --out-dir artifacts/release-evidence
```

## 3) Verify evidence integrity

```bash
pnpm release-evidence:verify -- --evidence-dir artifacts/release-evidence
```

## 4) Inspect key release pins

From `docs/release-readiness-report.md` and release evidence summary:

- `engineBuildHash`
- `gasVersion`
- consensus mismatch counts
- exact OOG parity status

## 5) Validate max-gas safety model

- Confirm OOG boundary parity checks are green in workload and consumer reports.
- Confirm release policy still enforces exact OOG boundary parity for consensus
  executors.

## 6) Confirm production scope claim

- Consensus-safe claim is wasm-node vs wasm-browser required matrix.
- Native remains diagnostic-only unless explicitly promoted by release policy.
