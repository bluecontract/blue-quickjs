# 09 — Production embedder checklist

This final page turns the learning path into operational rules for real
deployments.

## Prerequisites

- Complete [07 — Verify release evidence](./07-verify-release-evidence.md)
- Read [Consensus-safe vs diagnostic-only](../consensus-safe-vs-diagnostic-only.md)

## Commands

Run the most important local release/consumer checks:

```bash
pnpm release-evidence:verify -- --evidence-dir artifacts/release-evidence
pnpm workload:check-public-package-versions
pnpm workload:check-pack-manifests -- --out-dir artifacts/consumer-proof/pack-manifests
```

## Expected output

- Release evidence verification should pass without checksum/signature errors.
- Public package version alignment should pass.
- Pack manifest validation should emit a deterministic manifest summary in
  `artifacts/consumer-proof/pack-manifests`.

## What you learned

- Production embedders should pin:
  - `engineBuildHash`
  - `gasVersion`
  - ABI manifest hash
  - execution profile
- Production release confidence comes from generated evidence and rehearsed
  packaging flows, not from ad hoc local runs.
- Consensus-safe deployment guidance is narrower than the full repo surface.

## Continue

Next: return to the [documentation hub](../README.md), then revisit the full
[Production embedder checklist](../production-embedder-checklist.md) and
[Release checklist](../release-checklist.md).

## Troubleshooting

- If verification fails, regenerate the evidence bundle and retry before
  changing any release metadata manually.
- If package version alignment fails, fix the public package manifests before
  attempting a release rehearsal.
