# Signature rotation and emergency rollback

This document defines operational handling for evidence-signing key rotation and
release rollback when deterministic pins (`engineBuildHash`, `gasVersion`) move.

## Key rotation policy

1. Maintain a current active signing key pair and a staged next key pair.
2. Publish/commit the active public verification key material used by auditors.
3. Rotate keys on schedule or on compromise suspicion.
4. During rotation windows, optionally dual-sign evidence bundles until all
   verifiers have adopted the new key.

## Verification key updates

- Any key update must be called out in release notes.
- CI verification jobs must validate signatures against the expected key for the
  release line.
- Auditors should reject evidence signed by unknown/untrusted keys.

## Emergency rollback triggers

Rollback is required when any of the following occur:

- signature verification failures on release evidence bundle,
- manifest/checksum mismatch in archived release artifacts,
- unintended `engineBuildHash` movement,
- unintended `gasVersion` movement,
- deterministic mismatch regression in consensus reports.

## Rollback procedure (minimum)

1. Halt release/publish jobs.
2. Mark current candidate as revoked.
3. Rebuild and regenerate release evidence on last-known-good commit.
4. Re-verify:
   - `pnpm release-evidence:verify`
   - strict consensus parity reports.
5. Publish rollback advisory with revoked hashes/versions and replacement
   evidence bundle.

## Mandatory operator checks before unpausing

- `engineBuildHash` explicitly reviewed and expected.
- `gasVersion` explicitly reviewed and expected.
- release-evidence manifest hash recorded in go/no-go template.
- consensus mismatch counts and OOG parity status are green.
