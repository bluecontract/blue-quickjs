# HEAD verification note

This document is the quickest “state of HEAD” snapshot for engineers, auditors,
and release reviewers. Use it to confirm that the branch still matches the
current wasm-consensus product contract.

## Consensus-safe scope

Consensus-safe release scope remains:

- `wasm-node`
- `wasm-browser`
- canonical `wasm32` release artifacts

Release-critical parity is exact across those executors for:

- value or error,
- gas used and gas remaining,
- host-call tape,
- first-success / last-failure OOG boundary.

## Diagnostic-only scope

The following remain outside the current consensus release gate:

- native harness parity,
- WebKit browser runs,
- other Wasm variants or debug builds used for investigation.

These surfaces are still useful for debugging and reconciliation, but they
should not be presented as consensus executors.

## Pins and shipped contracts

The release story at HEAD should be internally consistent across docs, runtime
checks, and generated evidence:

- execution profiles:
  - `baseline-v1`
  - `compat-general-v1`
  - `compat-binary-v1`
- builder/runtime artifact contract:
  - `ProgramArtifact.v2`
  - `ModulePack.v1`
- explicit pins:
  - `engineBuildHash`
  - `gasVersion`
  - ABI manifest hash

## What a reviewer should verify

1. Consensus mismatch counts are zero.
2. Workload certification mismatch counts are zero.
3. OOG boundary parity is exact for the release corpus.
4. Consumer-proof tarball and Verdaccio rehearsals still pass.
5. Docs still describe the same scope that the generated evidence proves.

## Quick verification commands

```bash
source tools/emsdk/emsdk_env.sh
pnpm nx test smoke-node
pnpm nx run smoke-web:e2e
pnpm nx test ecosystem-certifier
pnpm nx run ecosystem-certifier:e2e
node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs --out-dir artifacts/reproducibility-consensus
node apps/ecosystem-certifier/scripts/archive-workload-certification-report.mjs --out-dir artifacts/workload-certification
pnpm release-evidence:synthesize -- --out-dir artifacts/release-evidence
pnpm release-evidence:verify -- --evidence-dir artifacts/release-evidence
```

## Known limitations at HEAD

- Consensus-safe execution is wasm-only; native remains diagnostic-only.
- Runtime network/fetch/import behavior is intentionally excluded from the
  consensus surface.
- Live binary and Promise support are profile-gated and should not be assumed in
  `baseline-v1`.

## Where to continue

- Product overview: [`README.md`](../README.md)
- Documentation hub: [`README.md`](./README.md)
- Architecture overview: [`architecture-overview.md`](./architecture-overview.md)
- Examples corpus: [`../examples/README.md`](../examples/README.md)
- Release readiness summary: [`release-readiness-report.md`](./release-readiness-report.md)
- Workload certification: [`workload-certification.md`](./workload-certification.md)
- Ecosystem compatibility: [`ecosystem-compatibility-report.md`](./ecosystem-compatibility-report.md)
- Consensus vs diagnostic scope: [`consensus-safe-vs-diagnostic-only.md`](./consensus-safe-vs-diagnostic-only.md)
