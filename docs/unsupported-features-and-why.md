# Unsupported features and why

BlueQuickjs is intentionally narrower than a general-purpose JavaScript
runtime. Unsupported features are not arbitrary omissions; they are deliberate
choices to preserve deterministic behavior and auditability.

## Unsupported in the consensus baseline

### Dynamic code generation

- `eval`
- `Function`

Why: these widen the executable surface at runtime and make review/auditing much
harder.

### Ambient nondeterminism

- clocks and wall time
- randomness
- timers
- filesystem
- network
- locale-sensitive ambient behavior

Why: independent nodes must not depend on host-local state or scheduling.

### Runtime module loading

- dynamic `import()`
- runtime fetch/import/network resolution

Why: module graphs must be fixed at build time and represented as
`ModulePack.v1`.

## Unsupported unless a compatibility profile enables them

### Promise jobs and microtasks

Allowed only in:

- `compat-general-v1`
- `compat-binary-v1`

Why: Promise job draining must be deterministic and explicitly versioned.

### Typed arrays / `ArrayBuffer` / `DataView`

Allowed only in:

- `compat-binary-v1`

Why: binary boundaries require DV2 / `Host.v2` semantics and must not widen the
baseline accidentally.

## Unsupported as consensus executors

### Native runtime parity

Native is still used heavily for diagnostics, reconciliation, and harness work,
but it is not part of today’s consensus release gate.

### Diagnostic browser paths

WebKit and other diagnostic browser runs may be useful, but the required
release matrix today is Chromium/Firefox-backed wasm browser execution.

## Related docs

- [Determinism profile](./determinism-profile.md)
- [Execution profiles](./execution-profiles.md)
- [Value model v2 (DV2)](./value-model-v2.md)
- [Consensus-safe vs diagnostic-only](./consensus-safe-vs-diagnostic-only.md)
