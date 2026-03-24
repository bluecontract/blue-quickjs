# Deterministic builder

This document defines the target behavior for the deterministic build pipeline.

## Naming decision

`deterministic-bundler` is a transitional bridge name. The long-term product
surface is **deterministic builder** because it emits first-class reusable
artifacts (`ModulePack.v1`, `ProgramArtifact.v2`), not just one script blob.

### Current implementation status (P14)

- `@blue-quickjs/deterministic-bundler` now exports
  `buildDeterministicModulePack(...)` for `ModulePack.v1` emission.
- `@blue-quickjs/deterministic-builder` is introduced as a migration facade that
  re-exports the deterministic builder APIs.
- `bundleDeterministicProgram(...)` remains available for transitional
  script-mode execution.
- Builder result shape now includes:
  - `CompatibilityReport.v1`
  - optional embedded `ProgramArtifact.v2` output
  - graph-hash golden test lock for serialization stability.

## Goals

- Deterministic JS/TS authoring pipeline for real libraries.
- Build-time resolution of npm/package imports.
- Emission of canonical module-pack artifacts and compatibility reports.

## Inputs

- Entry source: JS / TS / MJS / CJS.
- Installed dependencies + lockfile/integrity data.
- Execution profile target.
- Optional `dependencyIntegrity` override as lowercase SHA-256 hex (64 chars).

## Outputs

Required:

- `ModulePack.v1`
- compatibility report
- canonical source maps

Optional:

- single-script debug artifact for transitional workflows

## Deterministic constraints (normative)

1. No network fetches during deterministic build.
2. No absolute path influence on hashed outputs.
3. Same graph + same dependencies => same `graphHash` across Linux/macOS/Windows.
4. Compatibility scanning must run on transformed JS or TS-aware AST, not raw TS
   source text.
5. Dependency provenance is captured for diagnostics:
   - package name,
   - package version,
   - integrity/lock fingerprint (`dependencyIntegrity`, lowercase SHA-256 hex),
   - origin path (diagnostics-only metadata).

## Build pipeline stages

1. Resolve graph deterministically.
2. Transform sources to normalized JS modules.
3. Rewrite imports to canonical internal specifiers.
4. Run compatibility scan using selected profile/capability registry.
5. Emit module-pack + source maps + report.
6. Compute `graphHash`.
7. Emit `ProgramArtifact.v2` referencing module-pack and explicit profile.

## Source map requirements

- Canonical JSON formatting.
- Stable ordering for deterministic serialization.
- Path-clean mapping data (no absolute host paths in hashed content).

## Release artifact rule

Builder-produced release artifacts MUST include `engineBuildHash` and explicit
`executionProfile`, and `gasVersion`.

## See also

- `docs/program-artifact-v2.md`
- `docs/module-pack.md`
- `docs/execution-profiles.md`
