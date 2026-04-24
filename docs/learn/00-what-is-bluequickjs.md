# 00 — What is BlueQuickjs?

BlueQuickjs is a deterministic JavaScript execution stack built on a hardened
QuickJS engine compiled to Wasm. It is designed for **consensus-critical**
execution where independent runtimes must agree on:

- value or error,
- gas used and gas remaining,
- host-call tape,
- exact out-of-gas boundary.

Consensus-safe release scope today is deliberately narrow:

- `wasm-node`
- `wasm-browser`
- canonical `wasm32` release artifacts only

Native tooling exists for diagnostics, debugging, and reconciliation, but it is
**not** part of the consensus release contract unless a future release policy
promotes it explicitly.

## Prerequisites

- Node.js `>= 22.0.0`
- `pnpm`
- repository checkout with submodules initialized

## Commands

Build the CLI and inspect the current command surface:

```bash
pnpm install
pnpm nx build blue-quickjs-cli
node tools/blue-quickjs-cli/dist/cli.js help
```

## Expected output

You should see a command list that includes deterministic build/run/report
paths such as:

- `build`
- `run`
- `inspect`
- `consensus-report`
- `native-report`

That command surface mirrors the product shape:

- build deterministic artifacts,
- run them in wasm,
- generate reproducibility evidence,
- keep native as an explicit diagnostic path.

## What you learned

- BlueQuickjs is a deterministic **artifact + runtime + evidence** system, not
  just a JS interpreter.
- Consensus-safe execution is currently wasm-only (`wasm-node` vs
  `wasm-browser`).
- Exact gas and exact OOG boundaries are part of the release contract.
- Profiles determine which compatibility features are available:
  `baseline-v1`, `compat-general-v1`, and `compat-binary-v1`.

## Continue

Next: [01 — Install and run your first script](./01-install-and-run-your-first-script.md)

## Troubleshooting

- If `pnpm install` fails, confirm your Node version matches the root
  `package.json` engines field.
- If the CLI build fails, run `bash tools/scripts/prepare-quickjs-source.sh` and
  then retry.
- For a scope summary without running commands, read
  [Consensus-safe vs diagnostic-only](../consensus-safe-vs-diagnostic-only.md).
