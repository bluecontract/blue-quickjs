# 07 — Verify release evidence

BlueQuickjs uses generated release evidence so auditors and operators can check
that the current branch or release bundle matches deterministic reality.

## Prerequisites

- Complete the toolchain setup from
  [01 — Install and run your first script](./01-install-and-run-your-first-script.md)

## Commands

Synthesize a local release evidence bundle and verify it:

```bash
pnpm release-evidence:synthesize -- --out-dir artifacts/release-evidence
pnpm release-evidence:verify -- --evidence-dir artifacts/release-evidence
```

## Expected output

- The synthesize step should create:
  - `release-evidence-summary.json`
  - `release-evidence-summary.md`
  - `release-evidence-manifest.json`
  - `*.sha256`
  - `*.sig`
- The verify step should exit successfully after checking:
  - manifest entries,
  - checksums,
  - signature payloads,
  - branch/date expectations when provided.

## What you learned

- Release evidence is a generated bundle, not a hand-written checklist.
- Verification checks both integrity (checksums/signatures) and release context.
- The release evidence bundle ties together consensus, workload, and
  consumer-proof artifacts.

## Continue

Next: [08 — Build a real example](./08-build-a-real-example.md)

## Troubleshooting

- If synthesis reports stale docs, regenerate the affected reports and rerun.
- If verification fails, inspect the manifest paths and checksum sidecars first.
- For the trust model, read [Release provenance and trust model](../release-provenance.md).
