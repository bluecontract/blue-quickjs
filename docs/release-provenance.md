# Release provenance and trust model

This document defines what release evidence is signed, how checksums are
produced, and how operators should validate trust before accepting a release.

## Signed artifacts

The release workflow generates a release-evidence bundle containing:

- `release-evidence-summary.json`
- `release-evidence-summary.md`
- `release-evidence-manifest.json`
- `*.sha256` sidecars
- `*.sig` detached signature payloads
- copied source evidence inputs (consensus/workload/consumer reports)

Generation command:

```bash
pnpm release-evidence:synthesize -- --out-dir artifacts/release-evidence
```

Verification command:

```bash
pnpm release-evidence:verify -- --evidence-dir artifacts/release-evidence
```

## Checksum model

- SHA-256 is used for all artifact checksum entries.
- Manifest entries include per-file `sha256` and relative path.
- `*.sha256` sidecars are generated for summary/manifest outputs.

## Signature model

The synthesizer emits detached `*.sig` payloads in one of two modes:

1. `ed25519` (preferred production mode, when signing key is supplied), or
2. `digest-fallback` (local/dev mode, checksum-backed proof only).

Production releases should always use an injected signing key and verify with
the corresponding public key in CI and by downstream auditors.

## Trust assumptions

Consumers should trust a release only when:

1. checksums match manifest entries,
2. detached signatures verify successfully,
3. branch/date/release metadata match expected release context,
4. consensus parity mismatch counts are zero and exact OOG parity is true.

## Related commands and docs

- `pnpm release-evidence:synthesize`
- `pnpm release-evidence:verify`
- `docs/release-policy.md`
- `docs/release-checklist.md`
- `docs/signature-rotation-and-rollback.md`
