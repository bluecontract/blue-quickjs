# Release Policy (Engine + ABI Pinning)

Scope: define publishing and versioning policy so consumers can pin engine + ABI deterministically (Baseline #1 §1A; Baseline #2 §7).

## Gas closure policy (release-critical)

Gas is part of the deterministic consensus contract, not a benchmark hint.
Release gating therefore requires:

- exact result/error/tape parity,
- exact gas used/remaining parity, and
- exact out-of-gas boundary parity

across all supported **consensus executors**.

Consensus executor matrix:

- mandatory: `wasm-node` vs `wasm-browser` using pinned canonical `wasm32`
  artifacts.
- native harness parity is required only when native is explicitly declared a
  supported consensus executor for that release.

`--gas-delta-baseline` style reconciliation artifacts are diagnostic tools only
and are never an acceptable release gate.

Release candidates must archive signed strict-parity reproducibility reports
(parity report JSON signature + file checksum) for auditability.
The repository command for the consensus wasm-node/wasm-browser report is:
`node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs`.
Native reproducibility reports remain diagnostic by default; use strict
assertion mode only when native is explicitly promoted to a consensus executor.

## Published packages

- `@blue-quickjs/dv`: DV encode/decode + validation (pure TS).
- `@blue-quickjs/abi-manifest`: manifest schema + canonical DV encoding + hashing (depends on DV).
- `@blue-quickjs/quickjs-wasm-constants`: shared wasm artifact constants + metadata types.
- `@blue-quickjs/quickjs-wasm`: packaged wasm + loader + build metadata (`quickjs-wasm-build.metadata.json`).
- `@blue-quickjs/quickjs-runtime`: SDK to evaluate `(P, I, G)` with manifest-backed host dispatch.

Internal-only (not published):

- `@blue-quickjs/quickjs-wasm-build` (build pipeline)
- `@blue-quickjs/test-harness` (fixtures/tests)

## Pinning inputs

A deterministic program artifact `P` should pin:

- `abiId`, `abiVersion`
- `abiManifestHash` (sha256 of canonical manifest bytes)
- `executionProfile` (explicit, versioned profile name)
- `gasVersion` (required for release-mode artifacts)
- `engineBuildHash` (required for builder-produced release artifacts)

`@blue-quickjs/quickjs-runtime` validates these fields and rejects mismatches when provided.
In `releaseMode`, embedders must pass an expected execution profile pin
(`expectedExecutionProfile`) so runtime execution fails on profile mismatches.

For release-mode execution, `engineBuildHash`, `gasVersion`, and
`executionProfile` are required pins.

For `ProgramArtifact.v2` module-pack outputs, pinning should additionally include:

- `sourceKind` (`script` vs `module-pack`)
- `modulePack.graphHash` when `sourceKind = "module-pack"`

See:

- `docs/program-artifact-v2.md`
- `docs/module-pack.md`
- `docs/execution-profiles.md`

## engine_build_hash

Definition:

- `engineBuildHash = sha256(wasm_bytes)` for a given variant + buildType.
- Lowercase hex, 64 characters.

`gasVersion` definition:

- Monotonic integer identifying the canonical gas schedule semantics.
- Any semantic gas-schedule change (including allocation charging model changes)
  requires an explicit gasVersion bump.

Exposure:

- `quickjs-wasm-build.metadata.json` includes:
  - top-level `gasVersion` for runtime/artifact gas pin validation.
  - `variants.<variant>.<buildType>.engineBuildHash` for every emitted artifact.
  - Top-level `engineBuildHash`, set to the canonical engine hash (`wasm32` + `release`) when present.
- `@blue-quickjs/quickjs-wasm` exposes these values via `loadQuickjsWasmMetadata()` and
  `QuickjsWasmArtifact.variantMetadata.engineBuildHash`.

Usage:

- Consumers should embed the canonical hash in `P.engineBuildHash` to pin the engine.
- If running a non-canonical build (debug or wasm64), pin to that variant's `engineBuildHash` instead.

## abi_manifest_hash

Definition:

- `abiManifestHash = sha256(encodeAbiManifest(manifest))` using canonical DV encoding
  (`@blue-quickjs/abi-manifest`).

All manifest byte changes produce a new hash and must be reflected in `P.abiManifestHash`.

## Semver policy (packages)

Semver communicates JS/TS API compatibility; engine/ABI pinning is done via hashes.

- `@blue-quickjs/quickjs-wasm` + `@blue-quickjs/quickjs-runtime` are released together
  with the same version.
  - Major: deterministic semantics changes (gas schedule, determinism profile, host-call ABI,
    manifest schema, or other changes that can alter outputs or OOG boundaries).
  - Minor: additive APIs or new Host.v1 functions (new `fn_id`) that do not invalidate
    existing programs.
  - Patch: bugfixes or packaging changes that do not change deterministic outputs.

- `@blue-quickjs/quickjs-wasm-constants`:
  - Major: breaking type/constant changes.
  - Minor: additive types/constants.
  - Patch: packaging or doc-only changes.

- `@blue-quickjs/dv`:
  - Major: wire-format changes, numeric rules/limits changes.
  - Minor: additive helpers/options.
  - Patch: bugfixes with identical wire format.

- `@blue-quickjs/abi-manifest`:
  - Major: manifest schema or validation rule changes.
  - Minor: additive helpers/options.
  - Patch: bugfixes.

## Change triggers (hashes and IDs)

New `engineBuildHash` is required when:

- Any change to the QuickJS fork, deterministic init/profile, gas schedule, host-call ABI,
  memory sizing, toolchain version, or build flags alters the wasm bytes.
- Rebuilding with different Emscripten/flags also produces a new hash.

New `gasVersion` is required when:

- Any change can alter canonical gas used/remaining or OOG boundaries for the
  same `(P, I, G)`.
- This includes changes to opcode charges, builtin charges, host-call charging,
  allocation charging model, or GC checkpoint charging semantics.

New `abiManifestHash` is required when:

- Any manifest field changes: function list, `fn_id`, `js_path`, `arg_schema`,
  `return_schema`, gas, limits, or `error_codes`.

New `fn_id` is required when:

- Introducing a new host capability, or changing the signature/meaning of an existing one.
- `fn_id` values are never reused.

`abi_version` / `abi_id` policy:

- Bump `abi_version` when the manifest schema or host-call ABI changes in a way that older
  hosts/VMs cannot interpret.
- For incompatible surface changes, use a new `abi_id` (e.g., `Host.v2`).
