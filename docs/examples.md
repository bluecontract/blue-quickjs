# Examples guide

The canonical runnable corpus lives in:

- [`examples/README.md`](../examples/README.md)

## How to read the corpus

Each example category in `examples/README.md` is tied to fixture-backed evidence
from the strict consensus parity flow (`wasm-node` vs `wasm-browser`).

For every category, the corpus identifies:

- source files,
- execution profile (`baseline-v1`, `compat-general-v1`, `compat-binary-v1`),
- deterministic rationale,
- gas/result evidence keys,
- OOG-boundary evidence where relevant,
- environment coverage notes (consensus executors vs native diagnostics).

## Consensus-safe vs diagnostic-only interpretation

- **Consensus-safe evidence:** wasm-node + wasm-browser strict parity report.
- **Diagnostic-only evidence by default:** native harness reports.

## Runbook entrypoints

Use the corpus runbook in `examples/README.md` for:

- smoke-node and smoke-web parity execution,
- consensus reproducibility archive generation,
- optional native diagnostic reproducibility runs.
