# BlueQuickjs docs

BlueQuickjs is a deterministic JavaScript execution stack for
**consensus-critical wasm32 evaluation**. These docs are organized around the
jobs readers actually need to do: learn the model, build artifacts, verify
determinism, operate safely, and audit a release.

## Learn BlueQuickjs

Best for: new engineers, reviewers, and anyone learning the product from
scratch.

- [Learning path overview](./learn/README.md) — guided route through the first
  ten documents.
- [What is BlueQuickjs?](./learn/00-what-is-bluequickjs.md) — concept, scope,
  and consensus-safe executor matrix.
- [Install and run your first script](./learn/01-install-and-run-your-first-script.md)
  — fastest path to a successful deterministic run.
- [Understand the program artifact](./learn/02-understand-the-program-artifact.md)
  — `ProgramArtifact.v2`, pins, profiles, and release-mode expectations.
- [Module packs and imports](./learn/03-module-packs-and-imports.md) — why
  imports are resolved at build time instead of runtime.
- [Promises, async, and microtasks](./learn/04-promises-async-and-microtasks.md)
  — what `compat-general-v1` enables and what remains intentionally blocked.
- [Binary mode and Host.v2](./learn/05-binary-and-host-v2.md) — bytes,
  `Uint8Array`, DV2, and typed-array-safe boundaries.
- [Gas, OOG, and max-gas policies](./learn/06-gas-oog-and-max-gas-policies.md)
  — exact gas meaning and why OOG boundaries are release-critical.
- [Verify release evidence](./learn/07-verify-release-evidence.md) — how to
  verify the current branch or a shipped release bundle.
- [Build a real example](./learn/08-build-a-real-example.md) — take an example
  from source to artifact to browser/node execution.
- [Production embedder checklist](./learn/09-production-embedder-checklist.md)
  — operational rules for consensus-safe deployments.
- [Glossary](./glossary.md)
- [FAQ](./faq.md)
- [Unsupported features and why](./unsupported-features-and-why.md)
- [Consensus-safe vs diagnostic-only](./consensus-safe-vs-diagnostic-only.md)

## Build with BlueQuickjs

Best for: engineers wiring BlueQuickjs into products, tooling, or example
pipelines.

- [Architecture overview](./architecture-overview.md) — source →
  deterministic builder → `ProgramArtifact.v2` → wasm runtime → evidence.
- [Program artifact v2](./program-artifact-v2.md)
- [Module pack v1](./module-pack.md)
- [Execution profiles](./execution-profiles.md)
- [Deterministic builder](./builder.md)
- [Value model v2 (DV2)](./value-model-v2.md)
- [Embedder integration guide](./embedders.md)
- [TypeScript SDK usage](./sdk.md)
- [Examples guide](./examples.md)
- [ABI limits explained](./abi-limits.md)

## Verify determinism

Best for: CI authors, auditors, and anyone checking whether what they see is
what consensus will see.

- [HEAD verification note](./head-verification-note.md)
- [Determinism profile](./determinism-profile.md)
- [Gas schedule](./gas-schedule.md)
- [Deterministic Value wire format](./dv-wire-format.md)
- [ABI manifest schema + canonical encoding](./abi-manifest.md)
- [Host call ABI](./host-call-abi.md)
- [Observability: host-call tape + gas trace](./observability.md)
- [Workload certification plan](./workload-certification-plan.md)
- [Workload certification report](./workload-certification.md)
- [Ecosystem compatibility report](./ecosystem-compatibility-report.md)
- [Ecosystem compatibility baseline (0.4.1)](./ecosystem-compatibility-baseline-0.4.1.json)
- [First 10 minutes guide](./first-10-minutes.md)

## Operate in production

Best for: embedders, operators, and teams deploying consensus-safe workloads.

- [Consensus-safe vs diagnostic-only](./consensus-safe-vs-diagnostic-only.md)
- [Production embedder checklist](./production-embedder-checklist.md)
- [Threat model (operator-facing)](./threat-model.md)
- [Toolchain and build determinism](./toolchain.md)
- [Repository metadata checklist](./repository-metadata-checklist.md)
- [GA cutover decision](./ga-cutover-decision.md)

## Release and audit

Best for: release managers, reviewers, and downstream auditors.

- [Release-readiness report](./release-readiness-report.md)
- [Release checklist](./release-checklist.md)
- [Release policy](./release-policy.md)
- [Release provenance and trust model](./release-provenance.md)
- [Signature rotation and rollback](./signature-rotation-and-rollback.md)
- [Release go/no-go template](./release-go-no-go-template.md)
- [Release notes draft](./release-notes-draft.md)
- [Implementation summary](./implementation-summary.md)
- [Implementation plan (historical)](./implementation-plan.md)

## Quick repo map

Most readers eventually jump from docs into one of these directories:

- **QuickJS fork + deterministic patches**: `vendor/quickjs/`
  - Deterministic init + gas metering: `vendor/quickjs/quickjs.c`
  - Host ABI + manifest parsing + Host wrappers: `vendor/quickjs/quickjs-host.c`
  - DV codec: `vendor/quickjs/quickjs-dv.c`
  - Wasm entrypoints: `vendor/quickjs/quickjs-wasm-entry.c`
- **Builder and runtime libraries**
  - `libs/deterministic-builder/`
  - `libs/deterministic-bundler/`
  - `libs/dv/`
  - `libs/abi-manifest/`
  - `libs/quickjs-wasm-build/`
  - `libs/quickjs-wasm/`
  - `libs/quickjs-runtime/`
  - `libs/test-harness/`
- **Executable apps**
  - `apps/smoke-node/`
  - `apps/smoke-web/`
  - `apps/ecosystem-certifier/`
- **Diagnostic native harness**
  - `tools/quickjs-native-harness/`
