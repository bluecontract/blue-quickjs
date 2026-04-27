# BlueQuickjs Docs

Start with the root [README quickstart](../README.md), then jump to the
reference you need.

## Start Here

- [Core concepts](./concepts.md)
- [Learning path](./learn/README.md)
- [Architecture overview](./architecture-overview.md)
- [FAQ](./faq.md)
- [Glossary](./glossary.md)

## Build And Use

- [TypeScript SDK usage](./sdk.md)
- [Deterministic builder](./builder.md)
- [ModulePack.v1](./module-pack.md)
- [ProgramArtifact.v2](./program-artifact-v2.md)
- [Examples guide](./examples.md)
- [Playground](./playground.md)
- [Playground recipes](./playground-recipes.md)

## Reference

- [Consensus-safe vs diagnostic-only](./consensus-safe-vs-diagnostic-only.md)
- [Execution profiles](./execution-profiles.md)
- [Determinism profile](./determinism-profile.md)
- [Gas schedule](./gas-schedule.md)
- [DV wire format](./dv-wire-format.md)
- [Value model v2 (DV2)](./value-model-v2.md)
- [ABI manifest](./abi-manifest.md)
- [Host call ABI](./host-call-abi.md)
- [ABI limits](./abi-limits.md)
- [Observability](./observability.md)
- [Unsupported features and why](./unsupported-features-and-why.md)

## Production

- [Production embedder checklist](./production-embedder-checklist.md)
- [Embedder integration guide](./embedders.md)
- [Threat model](./threat-model.md)
- [Toolchain](./toolchain.md)

## Release And Audit

- [HEAD verification note](./head-verification-note.md)
- [Release-readiness report](./release-readiness-report.md)
- [Release checklist](./release-checklist.md)
- [Release policy](./release-policy.md)
- [Release provenance and trust model](./release-provenance.md)
- [Signature rotation and rollback](./signature-rotation-and-rollback.md)
- [Workload certification report](./workload-certification.md)
- [Ecosystem compatibility report](./ecosystem-compatibility-report.md)

## Quick Repo Map

- QuickJS fork and deterministic patches: `vendor/quickjs/`,
  `vendor/quickjs-patches/`
- Builder and runtime libraries: `libs/deterministic-builder/`,
  `libs/deterministic-bundler/`, `libs/quickjs-runtime/`
- Wasm build and package libraries: `libs/quickjs-wasm-build/`,
  `libs/quickjs-wasm/`
- ABI and value libraries: `libs/abi-manifest/`, `libs/dv/`
- Smoke and certification apps: `apps/smoke-node/`, `apps/smoke-web/`,
  `apps/ecosystem-certifier/`
- Diagnostic native harness: `tools/quickjs-native-harness/`
