# Embedder integration guide

This document defines integration boundaries for systems embedding blue-quickjs.

## Scope boundary

This repository owns **deterministic evaluation**.

It does **not** own:

- workflow orchestration,
- overlay/commit pipelines,
- external persistence or job scheduling.

Those belong to the embedding system (for example document-processor).

## Embedder responsibilities

1. Build artifacts using deterministic builder outputs (`ProgramArtifact.v2`,
   `ModulePack.v1`).
2. Provide deterministic host handlers for declared ABI functions.
3. Supply deterministic input envelope data (`I`) and gas limit (`G`).
4. Pin and validate:
   - ABI manifest hash,
   - engine build hash,
   - execution profile.
5. Treat evaluator output (`result`, `gas`, `tape`, errors) as immutable
   execution evidence.

## Runtime constraints embedders must respect

- No reentrant host calls into VM.
- No async host callbacks during synchronous VM evaluation.
- No hidden side channels (clock, randomness, network/filesystem) bypassing ABI.

## Recommended integration flow

1. Resolve/build source -> `ModulePack.v1` + compatibility report.
2. Construct `ProgramArtifact.v2` with explicit profile and pins.
3. Execute via SDK runtime.
4. Record deterministic outputs and optional tape/trace.
5. Perform policy-specific post-processing outside evaluator boundary.

## Versioning expectations

- Treat profile names, ABI ids/versions, and value-model version as explicit
  contracts.
- Do not silently upgrade artifacts across incompatible versions.

## Parity expectations

For release confidence, embedders should run parity checks across:

- native harness,
- wasm in Node,
- wasm in browser,

matching on result hash, gas, tape, and error code/tag.

## See also

- `docs/sdk.md`
- `docs/program-artifact-v2.md`
- `docs/module-pack.md`
- `docs/value-model-v2.md`
