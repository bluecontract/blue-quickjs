# ABI Manifest (Baseline #2)

Scope: specify the manifest schema and hashing rules that map numeric function IDs to host capabilities per Baseline #2 (e.g., §1.1–§1.3).

## Goals
- Define manifest structure (versioning, host fn entries, DV typing).
- Document canonicalization + hash algorithm used to lock the manifest.
- Note validation rules at runtime and in build tooling.

## To document (Baseline #2 refs)
- §1.1–§1.3: manifest mapping, hashing, and validation.
- §6.1/§6.3: how manifest informs deterministic VM init and `Host.v1` generation.
- §2.x: host-call dispatch table and numeric IDs.

## TODO
- Add canonicalization steps and hash example once schema is finalized.
- Link to generator/validator tooling in `libs/abi-manifest`.
