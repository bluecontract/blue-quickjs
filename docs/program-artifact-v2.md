# ProgramArtifact.v2

Baseline anchors:

- `docs/baseline-1.md` (determinism + canonical gas)
- `docs/baseline-2.md` (manifest-locked host ABI + DV boundary)

This document defines the **versioned execution artifact** consumed by runtimes
and produced by the deterministic builder.

## Goals

- Replace ambiguous “just a code string” payloads with explicit execution modes.
- Make profile and engine pinning explicit.
- Support script mode and first-class module-pack mode under one schema.

## Schema (normative)

```ts
type ProgramArtifactV2 = {
  version: 2;
  abiId: string;              // e.g. "Host.v1" or "Host.v2"
  abiVersion: number;         // uint32
  abiManifestHash: string;    // lowercase sha256 hex, 64 chars
  engineBuildHash?: string;   // lowercase sha256 hex, 64 chars
  executionProfile: ExecutionProfileName;
  sourceKind: 'script' | 'module-pack';
  source: ScriptSource | ModulePackSource;
};

type ScriptSource = {
  code: string;
};

type ModulePackSource = {
  modulePack: ModulePackV1;
};
```

## Field rules

- `version` MUST be `2`.
- `executionProfile` is required. Release artifacts MUST NOT rely on implicit defaults.
- `sourceKind` and `source` shape MUST match.
- `engineBuildHash`:
  - REQUIRED for builder-produced release artifacts.
  - MAY be omitted only for local development/debug workflows that do not claim
    reproducible release semantics.

## Execution semantics

### `sourceKind: "script"`

- Evaluated as deterministic global script mode.
- Result is the final expression value (DV-encodable).

### `sourceKind: "module-pack"`

- Evaluated through deterministic in-memory static module loading from
  `ModulePack.v1` only.
- No runtime filesystem/network/module registry lookups.
- Entry resolution is driven by the module-pack entry fields.

## Validation failures (normative categories)

- `PROGRAM_ARTIFACT_INVALID`
- `PROGRAM_SOURCE_KIND_MISMATCH`
- `PROGRAM_PROFILE_REQUIRED`
- `PROGRAM_ENGINE_HASH_REQUIRED` (for build outputs)

Module-pack specific runtime errors are specified in `docs/module-pack.md`.

## Canonicalization and hashing guidance

`ProgramArtifact.v2` itself is typically transported as JSON-like host data, but
its pinned fields (`abiManifestHash`, `engineBuildHash`, `modulePack.graphHash`)
MUST be computed from canonical byte representations defined in their respective
specs.

## Relationship to v1 artifacts

- v1 (`code` + ABI pins) remains supported only as a compatibility input path.
- New builder output target is v2.
- New features (module-pack execution, composite profiles, DV2/Host.v2) are
  specified against v2.

## See also

- `docs/module-pack.md`
- `docs/execution-profiles.md`
- `docs/builder.md`
- `docs/value-model-v2.md`
