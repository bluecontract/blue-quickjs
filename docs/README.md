# Documentation index

This repository is a deterministic JavaScript execution environment built on **QuickJS** compiled to **WebAssembly**, with a **manifest-locked Host ABI**, a canonical **Deterministic Value (DV)** wire format, and **deterministic gas metering**.

The docs are split between:

- **Baselines** (what must be true)
- **Implementation plan** (how we intended to build it)
- **Implementation summary + guides** (what was built, how to use it)
- **Reference specs** (normative, detail-heavy)

If you are new to determinism/gas (or coming from “normal” JS runtimes), follow the reading order below.

## Recommended reading order

1. **Baselines (requirements / contracts)**
   - [Baseline #1 – Deterministic JS engine](./baseline-1.md)
   - [Baseline #2 – Host ABI + DV contract](./baseline-2.md)

2. **Plan (design log)**
   - [Implementation plan](./implementation-plan.md)

3. **What was built (narrative + repo map)**
   - [Implementation summary](./implementation-summary.md)
   - [Head verification note](./head-verification-note.md)

4. **Reference specs (details, normative behavior)**
   - [Determinism profile](./determinism-profile.md)
   - [Gas schedule](./gas-schedule.md)
   - [Deterministic Value wire format](./dv-wire-format.md)
   - [Program artifact v2](./program-artifact-v2.md)
   - [Module pack v1](./module-pack.md)
   - [Execution profiles](./execution-profiles.md)
   - [Deterministic builder](./builder.md)
   - [Value model v2 (DV2)](./value-model-v2.md)
   - [Embedder integration](./embedders.md)
   - [ABI manifest schema + canonical encoding](./abi-manifest.md)
   - [Host call ABI (the `host_call` syscall)](./host-call-abi.md)
   - [Toolchain + build determinism](./toolchain.md)
   - [Release + compatibility policy](./release-policy.md)
  - [Release-readiness report](./release-readiness-report.md)
  - [Release provenance and trust model](./release-provenance.md)
  - [Signature rotation and rollback](./signature-rotation-and-rollback.md)
  - [Workload certification plan](./workload-certification-plan.md)
  - [Workload certification report](./workload-certification.md)
  - [Ecosystem compatibility report](./ecosystem-compatibility-report.md)
  - [Ecosystem compatibility baseline (0.4.1)](./ecosystem-compatibility-baseline-0.4.1.json)

5. **Developer guides (practical usage)**
   - [TypeScript SDK usage](./sdk.md)
   - [ABI limits explained](./abi-limits.md)
   - [Observability: host-call tape + gas trace](./observability.md)
   - [Release notes draft](./release-notes-draft.md)
   - [Repository metadata checklist](./repository-metadata-checklist.md)
   - [Threat model (operator-facing)](./threat-model.md)
   - [Production embedder checklist](./production-embedder-checklist.md)
   - [Release go/no-go template](./release-go-no-go-template.md)
   - [First 10 minutes guide](./first-10-minutes.md)
   - [GA cutover decision](./ga-cutover-decision.md)

## Quick “repo map”

Most people end up reading some docs and then jumping into these locations:

- **QuickJS fork + deterministic patches**: `vendor/quickjs/`
  - Deterministic init + gas metering: `vendor/quickjs/quickjs.c`
  - Host ABI + manifest parsing + Host.v1 wrappers: `vendor/quickjs/quickjs-host.c`
  - DV codec: `vendor/quickjs/quickjs-dv.c`
  - SHA-256 helper used for tape hashing: `vendor/quickjs/quickjs-sha256.c`
  - Wasm entrypoints: `vendor/quickjs/quickjs-wasm-entry.c`

- **TypeScript libraries**
  - Deterministic builder/bundler bridge + compatibility scan: `libs/deterministic-bundler/`
  - DV reference implementation: `libs/dv/`
  - Manifest schema + canonical encoding/hashing: `libs/abi-manifest/`
  - Wasm constants + metadata types: `libs/quickjs-wasm-constants/`
  - Wasm build pipeline + metadata: `libs/quickjs-wasm-build/`
  - Packaged wasm artifacts: `libs/quickjs-wasm/`
  - Runtime SDK (evaluate / init / dispatcher): `libs/quickjs-runtime/`
  - Shared fixtures + parsers: `libs/test-harness/`

- **Executable examples**
  - Node smoke runner: `apps/smoke-node/`
  - Browser smoke runner: `apps/smoke-web/`

- **Native harness (golden tests & debugging)**
  - `tools/quickjs-native-harness/`
