# Architecture overview

BlueQuickjs turns source code into a pinned, deterministic execution artifact
that can be evaluated in consensus-safe wasm runtimes and then verified against
generated evidence.

## End-to-end flow

```text
source files / examples / package entrypoints
            │
            ▼
deterministic builder
(`buildDeterministicModulePack`, `blue-quickjs build`)
            │
            ├─ compatibility diagnostics
            ├─ ModulePack.v1
            └─ ProgramArtifact.v2
                 - executionProfile
                 - abiManifestHash
                 - engineBuildHash
                 - gasVersion
                 - sourceKind
            │
            ▼
wasm runtime (`@blue-quickjs/quickjs-runtime`)
            │
            ├─ wasm-node
            └─ wasm-browser
                 with identical:
                 - value/error
                 - gas used/remaining
                 - host-call tape
                 - OOG boundary
            │
            ▼
generated evidence and reports
            ├─ consensus reproducibility report
            ├─ workload certification report
            ├─ ecosystem compatibility report
            └─ release evidence bundle
```

## The important product boundaries

### 1. Builder stage

The deterministic builder resolves imports, normalizes module sources, runs
profile-aware compatibility checks, and emits:

- [`ModulePack.v1`](./module-pack.md) for static in-memory module execution
- [`ProgramArtifact.v2`](./program-artifact-v2.md) for pinned execution
- compatibility diagnostics for unsupported behavior

This is where runtime `import()`/network/filesystem behavior is deliberately
removed from the consensus path. Imports are resolved **before** execution.

### 2. Artifact stage

`ProgramArtifact.v2` is the release-facing contract that binds together:

- source mode (`script` or `module-pack`)
- execution profile
- ABI identity and manifest hash
- engine build pin (`engineBuildHash`)
- gas schedule pin (`gasVersion`)

See:

- [`ProgramArtifact.v2`](./program-artifact-v2.md)
- [`Execution profiles`](./execution-profiles.md)
- [`ModulePack.v1`](./module-pack.md)

### 3. Runtime stage

The runtime loads the canonical `wasm32` release engine and evaluates the
artifact against:

- deterministic input envelope data,
- a manifest-locked host ABI,
- an exact gas limit,
- optional tape/trace capture.

Consensus-safe release scope is currently:

- `wasm-node`
- `wasm-browser`

Native remains diagnostic-only unless explicitly promoted by release policy.

See:

- [`Determinism profile`](./determinism-profile.md)
- [`Host call ABI`](./host-call-abi.md)
- [`Consensus-safe vs diagnostic-only`](./consensus-safe-vs-diagnostic-only.md)

### 4. Evidence stage

What users see in docs, reports, and release artifacts should come from
generated evidence rather than hand-maintained prose. The repo already produces:

- consensus parity reports,
- workload certification and ecosystem compatibility reports,
- release evidence manifests, checksums, and signatures.

See:

- [`HEAD verification note`](./head-verification-note.md)
- [`Workload certification`](./workload-certification.md)
- [`Release-readiness report`](./release-readiness-report.md)
- [`Release provenance and trust model`](./release-provenance.md)

## Where to look in the repo

- Builder APIs: `libs/deterministic-builder/`, `libs/deterministic-bundler/`
- Wasm packaging: `libs/quickjs-wasm-build/`, `libs/quickjs-wasm/`
- Runtime SDK: `libs/quickjs-runtime/`
- Shared fixtures/evidence inputs: `libs/test-harness/`
- Examples corpus: `examples/`
- Browser/node certification apps:
  - `apps/smoke-web/`
  - `apps/smoke-node/`
  - `apps/ecosystem-certifier/`

## Continue learning

- Start the guided sequence at [Learn BlueQuickjs](./learn/README.md)
- Or jump straight to [Install and run your first script](./learn/01-install-and-run-your-first-script.md)
