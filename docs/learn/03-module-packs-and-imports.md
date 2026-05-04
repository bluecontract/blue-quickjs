# 03 — Module packs and imports

BlueQuickjs does not allow runtime fetch/import/network behavior in the
consensus path. Instead, the builder resolves imports ahead of time and emits a
deterministic `ModulePack.v1`.

That means:

- imports are part of the build step,
- the module graph is hashed,
- runtime execution is limited to the in-memory pack,
- the same source graph yields the same graph hash across environments.

## Prerequisites

- Node.js and `pnpm` installed
- CLI built with `pnpm nx build blue-quickjs-cli`

## Commands

Build and inspect the module-pack example that imports a sibling module:

```bash
mkdir -p tmp/learn-module-pack
node tools/blue-quickjs-cli/dist/cli.js build \
  --entry examples/02-module-pack/entry.js \
  --out tmp/learn-module-pack/program.json
node tools/blue-quickjs-cli/dist/cli.js inspect \
  --artifact tmp/learn-module-pack/program.json
node tools/blue-quickjs-cli/dist/cli.js run \
  --artifact tmp/learn-module-pack/program.json \
  --gas-limit 50000
```

## Expected output

- `build` should report `compatibilityOk: true`.
- `inspect` should show:
  - `sourceKind: "module-pack"`
  - a non-null `graphHash`
  - module specifiers for `./entry.js` and `./values.js`
- `run` should succeed with:
  - `ok: true`
  - a deterministic result (`7` for this example)
  - deterministic gas usage

## What you learned

- Imports are resolved at build time, not consensus-time.
- `ModulePack.v1` is the transport for deterministic static ESM execution.
- The module graph hash is part of what lets other environments verify they are
  running the same thing.
- “Imported library” support in BlueQuickjs means prebuilt deterministic packs,
  not an open-ended runtime module loader.

## Continue

Next: [04 — Promises, async, and microtasks](./04-promises-async-and-microtasks.md)

## Troubleshooting

- If the builder rejects a dependency, inspect its diagnostics with
  `blue-quickjs compat` or the CLI `build` output.
- If you want the normative schema, read [ModulePack.v1](../module-pack.md).
- For unsupported runtime import behavior, see
  [Unsupported features and why](../unsupported-features-and-why.md).
