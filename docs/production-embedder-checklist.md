# Production embedder checklist

Use this checklist before embedding BlueQuickjs in production consensus flows.

## A) Deterministic pinning

- [ ] Pin `engineBuildHash`.
- [ ] Pin `gasVersion`.
- [ ] Pin ABI manifest hash.
- [ ] Pin execution profile per workload (`baseline-v1` / `compat-*`).

## B) Runtime contract enforcement

- [ ] Enforce strict parity acceptance on required consensus executors.
- [ ] Enforce exact OOG boundary parity checks.
- [ ] Treat native output as diagnostic-only unless explicitly promoted.

## C) Host ABI discipline

- [ ] Route all host capabilities through manifest-defined Host ABI calls.
- [ ] Reject undocumented host functions/surfaces.
- [ ] Keep deterministic failure-stage expectations for unsupported behavior.

## D) Release evidence validation

- [ ] Verify `release-evidence-manifest.json`.
- [ ] Verify checksums for all listed artifacts.
- [ ] Verify detached signatures (`*.sig`) using trusted key material.
- [ ] Record manifest hash and parity summary in release go/no-go template.

## E) Security/supply chain

- [ ] Generate and archive SBOM (`pnpm release-evidence:sbom`).
- [ ] Generate and archive dependency license report (`pnpm release-evidence:licenses`).
- [ ] Review signature rotation / rollback runbook.

## F) Operational readiness

- [ ] Run consumer-proof matrix (Node 20/22 and multi-OS).
- [ ] Run registry-style publish rehearsal.
- [ ] Confirm docs/release notes match shipped consensus-safe scope.
