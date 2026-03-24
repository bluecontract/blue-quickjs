# Execution profiles and capability registry

Baseline anchor: `docs/baseline-1.md`.

This document defines the **profile model** for runtime capability gating and
builder compatibility checks.

## Design decision

The platform uses:

1. a **granular internal capability registry**, and
2. a **small public set of composite profiles**.

We do **not** expose a growing list of one-feature public profiles.

## Registry shape (conceptual)

```ts
type Capability =
  | 'regexp'
  | 'promiseJobs'
  | 'queueMicrotask'
  | 'stableSort'
  | 'consoleShim'
  | 'typedArrays'
  | 'dvBytes';
```

The registry is the single source of truth for:

- runtime validation,
- VM feature-flag wiring,
- builder compatibility scan,
- native harness profile flags,
- docs capability tables.

## Public profiles (normative)

### `baseline-v1`

Deterministic baseline close to current behavior:

- no Promise jobs / microtasks,
- no typed arrays / ArrayBuffer / DataView,
- no DV bytes boundary,
- no dynamic import/timers/runtime fs-network.

### `compat-general-v1`

`baseline-v1` +:

- `regexp`
- `promiseJobs`
- `queueMicrotask`
- `stableSort`
- `consoleShim`

### `compat-binary-v1`

`compat-general-v1` +:

- `typedArrays`
- `dvBytes`

## Transitional compatibility profile

`compat-regexp-v1` remains accepted as a transitional compatibility alias during
the migration from P11/P12 fixtures. It currently maps to:

- `baseline-v1` + `regexp`

New integrations should prefer `compat-general-v1` / `compat-binary-v1`.

## Artifact rule

`ProgramArtifact.v2.executionProfile` is required for build outputs and runtime
execution. Silent profile defaults are not allowed in release artifacts.

## Compatibility policy

- Baseline behavior MUST NOT widen unintentionally.
- Profile changes require explicit spec and tests.
- Public profile names are versioned contracts.

## See also

- `docs/program-artifact-v2.md`
- `docs/value-model-v2.md`
- `docs/determinism-profile.md`
