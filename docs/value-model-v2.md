# Value model v2 (DV2) and binary boundary support

Baseline anchors:

- `docs/baseline-1.md`
- `docs/baseline-2.md`
- current DV spec: `docs/dv-wire-format.md`

## Decision

Binary boundary support is delivered via a **new versioned value model** (DV2),
not by mutating DV1 in place.

## Why

- Current DV intentionally excludes byte strings.
- Typed-array-heavy libraries require a canonical bytes boundary.
- Versioning avoids breaking existing Host.v1/DV1 contracts.

## DV2 additions

DV2 extends DV1 with canonical byte strings:

- `bytes` type (canonical CBOR byte string form, definite-length only).

All existing DV1 canonical constraints still apply (finite numbers, canonical
ordering, deterministic size/depth limits).

## JS boundary mapping

- Wire `bytes` maps to `Uint8Array` at JS host/runtime boundaries.
- Within VM execution profiles that allow typed arrays, binary APIs can operate
  on ArrayBuffer/DataView/typed arrays.
- Non-byte typed arrays are runtime values, but boundary canonicalization must
  still be explicit and deterministic.

## ABI versioning policy

- Keep `Host.v1` + DV1 behavior unchanged.
- Introduce `Host.v2` (or equivalent ABI version bump) for DV2 boundary types.
- Mixed-version ambiguity is not allowed.

## Canonical encoding notes

- Definite lengths only.
- No non-canonical alternate encodings.
- No accidental acceptance of non-canonical buffer representations.

## Compatibility profile linkage

DV2 boundary bytes are enabled only when profile capabilities include `dvBytes`
(see `docs/execution-profiles.md`, e.g. `compat-binary-v1`).

## Test requirements

- bytes round-trip across host call args/returns and final result,
- canonical hash stability for byte values,
- rejection of non-canonical byte encodings,
- parity across native / wasm-node / wasm-browser.

## See also

- `docs/execution-profiles.md`
- `docs/abi-manifest.md`
