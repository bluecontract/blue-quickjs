# 08 — Build a real example

This page walks a real example from source files to deterministic artifact to
runtime execution.

We will use the kitchen-sink example because it exercises:

- module-pack imports,
- host calls,
- Promise job draining,
- `queueMicrotask`,
- stable sort behavior,
- deterministic tape emission.

## Prerequisites

- CLI built with `pnpm nx build blue-quickjs-cli`
- toolchain environment loaded:

  ```bash
  source tools/emsdk/emsdk_env.sh
  ```

## Commands

Build, inspect, and run the kitchen-sink example:

```bash
mkdir -p tmp/learn-kitchen-sink
node tools/blue-quickjs-cli/dist/cli.js build \
  --entry examples/09-kitchen-sink/entry.js \
  --profile compat-general-v1 \
  --out tmp/learn-kitchen-sink/program.json
node tools/blue-quickjs-cli/dist/cli.js inspect \
  --artifact tmp/learn-kitchen-sink/program.json
node tools/blue-quickjs-cli/dist/cli.js run \
  --artifact tmp/learn-kitchen-sink/program.json \
  --gas-limit 1000000
```

## Expected output

- `build` should succeed with `compatibilityOk: true`.
- `inspect` should show:
  - `sourceKind: "module-pack"`
  - `executionProfile: "compat-general-v1"`
  - a non-null `graphHash`
  - multiple module specifiers
- `run` should return a success payload with:
  - a structured object value,
  - deterministic gas numbers,
  - non-zero tape or host interaction metadata when appropriate.

## What you learned

- Real examples are still built as deterministic artifacts, not special cases.
- The profile pin matters when imported code uses Promise or microtask behavior.
- Host calls, module graphs, and gas accounting stay visible all the way through
  execution.

## Continue

Next: [09 — Production embedder checklist](./09-production-embedder-checklist.md)

## Troubleshooting

- If the build fails, check whether the selected profile matches the example’s
  capabilities.
- If the run fails, inspect the artifact first and confirm the example was built
  under `compat-general-v1`.
- For the source corpus overview, read [`examples/README.md`](../../examples/README.md).
