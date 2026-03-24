# blue-quickjs CLI

Deterministic command-line interface for build/run/inspect workflows.

## Commands

- `build` — build a deterministic module-pack artifact from an entry path.
- `compat` — emit compatibility diagnostics for an entry path/profile.
- `run` — evaluate an artifact JSON against a manifest/input envelope.
- `inspect` — print artifact metadata including module list, graph hash,
  provenance/package hints, and source-map presence.
- `explain-error` — map VM payloads to structured runtime error shapes and
  extract source locations (`path:line:column`) from mapped diagnostics.
- `consensus-report` — run wasm-node vs wasm-browser consensus reproducibility
  report generation (`tools/consensus-parity/...`), with optional
  `--browser chromium|firefox|webkit`.
- `native-report` — run native reproducibility archive generation (diagnostic by
  default; add `--strict` to assert zero mismatches).
- `native-parity` — run native parity report helper with strict/trace/baseline
  switches.
