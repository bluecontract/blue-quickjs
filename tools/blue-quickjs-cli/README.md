# blue-quickjs CLI

Deterministic command-line interface for build/run/inspect workflows.

## Build and invoke

```bash
pnpm nx build blue-quickjs-cli
node tools/blue-quickjs-cli/dist/cli.js help
```

## Commands

- `build` — build a deterministic module-pack artifact from an entry path.
- `compat` — emit compatibility diagnostics for an entry path/profile.
- `run` — evaluate an artifact JSON against a manifest/input envelope.
- `inspect` — print artifact metadata including module list, graph hash,
  provenance/package hints, and source-map presence.
- `explain-error` — map VM payloads to structured runtime error shapes and
  extract source locations (`path:line:column`) from mapped diagnostics.
- `consensus-report` — run wasm-node vs wasm-browser consensus reproducibility
  report generation (`tools/consensus-parity/...`).
- `native-report` — run native reproducibility archive generation (diagnostic by
  default; add `--strict` to assert zero mismatches).
- `native-parity` — run native parity report helper with strict/trace/baseline
  switches.

## Examples

### `build`

```bash
node tools/blue-quickjs-cli/dist/cli.js build \
  --entry examples/02-module-pack/entry.js \
  --profile baseline-v1 \
  --out artifacts/module-pack.program.json
```

### `compat`

```bash
node tools/blue-quickjs-cli/dist/cli.js compat \
  --entry examples/09-kitchen-sink/entry.js \
  --profile compat-general-v1 \
  --out artifacts/kitchen-sink.compat.json
```

### `inspect`

```bash
node tools/blue-quickjs-cli/dist/cli.js inspect \
  --artifact artifacts/module-pack.program.json
```

### `run`

```bash
node tools/blue-quickjs-cli/dist/cli.js run \
  --artifact artifacts/module-pack.program.json \
  --gas-limit 5000000
```

### `explain-error`

```bash
node tools/blue-quickjs-cli/dist/cli.js explain-error \
  --payload "TypeError: Promise is disabled in deterministic mode"
```

### `consensus-report`

```bash
node tools/blue-quickjs-cli/dist/cli.js consensus-report \
  --out-dir artifacts/reproducibility-consensus
```

### `native-report` (diagnostic by default)

```bash
node tools/blue-quickjs-cli/dist/cli.js native-report \
  --out-dir artifacts/reproducibility-native
```

### `native-parity`

```bash
node tools/blue-quickjs-cli/dist/cli.js native-parity \
  --assert-match \
  --out artifacts/reproducibility-native/parity-report.json
```
