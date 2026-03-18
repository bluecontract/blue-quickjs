# Release go / no-go template

Use this template for final release approval records.

## Release identity

- Date:
- Branch:
- Release tag / version:
- Decision: GO / NO-GO

## Deterministic pins

- `engineBuildHash`:
- `gasVersion`:
- ABI manifest hash:
- Evidence manifest hash:

## Shipped profiles

- [ ] `baseline-v1`
- [ ] `compat-general-v1`
- [ ] `compat-binary-v1`

## Corpus and certification counts

- Green corpus count:
- Red corpus count:
- Flagship workload count:
- Consensus mismatch count:
- Workload mismatch count:
- OOG mismatch count:

## Consensus executor claim

- Exact claim text:
  - `wasm-node` vs `wasm-browser` (required browser engines listed)
  - Native diagnostic-only status acknowledged.

## Evidence verification

- [ ] `pnpm release-evidence:verify` passed.
- [ ] Tamper detection check passed.
- [ ] SBOM generated and archived.
- [ ] License report generated and archived.

## Security / rollback readiness

- [ ] Signature key and verification path confirmed.
- [ ] Rollback procedure reviewed for this release.
- [ ] Threat model and production checklist reviewed.

## Approvers

- Engineering:
- Security:
- Release manager:
