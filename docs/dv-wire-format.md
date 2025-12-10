# DV Wire Format (Baseline #2)

Scope: document the deterministic value (DV) encoding/decoding rules per Baseline #2 (e.g., §1.4, §6.4).

## Goals
- Capture canonical encoding (byte layout, endianness, numeric/tag schema).
- Define validation rules and error surfaces for malformed input.
- Align JS/host representations and test fixtures.

## To document (Baseline #2 refs)
- §1.4: canonical DV encoding requirements.
- §6.4: `canon.unwrap`/`canon.at` semantics in the runtime.
- §9: interoperability expectations across host/guest boundaries.

## TODO
- Add examples/vectors once `libs/dv` solidifies.
- Cross-reference manifest field types in `abi-manifest.md`.
