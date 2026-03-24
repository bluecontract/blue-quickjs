# 01 — Install and run your first script

This page walks through the fastest path from a clean checkout to a successful
deterministic run with visible gas accounting.

## Prerequisites

- Node.js `>= 20.17.0`
- `pnpm`
- repository checkout with submodules initialized

## Commands

Install dependencies, set up the pinned Wasm toolchain, build the CLI, create a
tiny entry module, build a deterministic artifact, and run it:

```bash
pnpm install
bash tools/scripts/setup-emsdk.sh
source tools/emsdk/emsdk_env.sh
pnpm nx build blue-quickjs-cli
mkdir -p tmp/learn-first-script
printf 'export default (() => 1 + 2)();\n' > tmp/learn-first-script/entry.js
node tools/blue-quickjs-cli/dist/cli.js build \
  --entry tmp/learn-first-script/entry.js \
  --out tmp/learn-first-script/program.json
node tools/blue-quickjs-cli/dist/cli.js run \
  --artifact tmp/learn-first-script/program.json \
  --gas-limit 1000000
```

## Expected output

The `build` command should print a JSON summary with fields like:

- `compatibilityOk: true`
- `moduleCount`
- `graphHash`

The `run` command should print a success payload shaped like:

```json
{
  "ok": true,
  "value": 3,
  "gasUsed": "...",
  "gasRemaining": "...",
  "tapeLength": 0
}
```

The exact gas numbers matter and are deterministic for the same artifact,
inputs, and gas limit.

## What you learned

- How to install the pinned Emscripten toolchain used for wasm builds.
- How to build a deterministic artifact from source.
- How to execute that artifact and inspect deterministic gas output.
- That a simple local script already runs through the same artifact model used
  by the wider product.

## Continue

Next: [02 — Understand the program artifact](./02-understand-the-program-artifact.md)

## Troubleshooting

- If `setup-emsdk.sh` fails, read [Toolchain + build determinism](../toolchain.md).
- If the build command reports compatibility diagnostics, confirm the file uses
  plain deterministic JS and no unsupported APIs.
- If `run` fails with an execution-profile or pin error, inspect the artifact in
  the next step before editing fields manually.
