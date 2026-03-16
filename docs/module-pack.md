# ModulePack.v1

Baseline anchors:

- `docs/baseline-1.md`
- `docs/baseline-2.md`

`ModulePack.v1` is the canonical reusable source-module artifact for deterministic
runtime execution.

## Schema (normative)

```ts
type ModulePackV1 = {
  version: 1;
  entrySpecifier: string;
  entryExport?: string; // default: "default"
  modules: ModuleRecord[];
  graphHash: string;    // lowercase sha256 hex, 64 chars
  builderVersion: string;
  dependencyIntegrity: string; // lowercase sha256 hex, 64 chars
  diagnosticsMeta?: Record<string, unknown>; // non-hashed metadata only
};

type ModuleRecord = {
  specifier: string;
  source: string;
  sourceMap?: string; // canonical source map JSON string
  originMeta?: {
    packageName?: string;
    packageVersion?: string;
    integrity?: string; // optional lowercase sha256 hex, 64 chars
    originalPath?: string; // diagnostics only; never hashed
  };
};
```

## Deterministic requirements

### 1) Canonical module ordering

`modules` MUST be sorted by canonical `specifier` byte order (UTF-8, ascending).

### 2) Source normalization

- Module source MUST use LF (`\n`) line endings.
- Trailing line ending normalization MUST be deterministic.

### 3) Specifier normalization

- All specifiers MUST use `/` separators.
- No absolute OS paths.
- Relative imports MUST be canonicalized during build.
- Bare package imports MUST be resolved at build time to canonical internal
  specifiers.

### 4) Hash independence from machine/checkout

Hashed content MUST NOT include:

- absolute paths,
- host OS path separators,
- timestamps,
- nondeterministic build metadata.

### 5) Graph hash

`graphHash = sha256(canonical_module_pack_bytes)`

Where canonical bytes are produced from the ordered module list and normalized
fields only (excluding non-hashed diagnostics metadata).

## Runtime loader contract

When a runtime executes `sourceKind: "module-pack"`:

- only module records in the pack are loadable,
- relative imports resolve within the pack graph,
- cyclic imports and live bindings MUST follow static ESM semantics,
- entry module namespace is queried for `entryExport` (default `"default"`),
- result is DV/DV2-encoded according to selected ABI/value-model version.

## Deterministic error codes

- `MODULE_PACK_HASH_MISMATCH`
- `MODULE_SPECIFIER_NOT_FOUND`
- `MODULE_EXPORT_MISSING`
- `MODULE_RESOLUTION_ERROR`
- `MODULE_EVALUATION_ERROR`

## Source maps

- `sourceMap` values MUST be canonical JSON and path-clean (no absolute paths in
  hashed payloads).
- Path rewriting rules are specified in `docs/builder.md`.

## See also

- `docs/program-artifact-v2.md`
- `docs/builder.md`
