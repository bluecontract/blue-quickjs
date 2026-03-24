# BlueQuickjs Playground

The in-repo playground is the canonical interactive demo surface for the
wasm-consensus product.

It is designed to help new engineers:

- run deterministic JavaScript in the browser,
- inspect result/error, gas, and tape outputs,
- understand execution profiles,
- compare a browser run against certified evidence,
- inspect exact OOG boundaries,
- learn what is consensus-safe vs diagnostic-only.

## What the playground is for

Use it when you want a high-signal, evidence-backed browser experience without
leaving the repo.

The playground is especially useful for:

- onboarding,
- release review demos,
- teaching profiles and pins,
- validating that a certified example still matches generated evidence.

## What runs live

### Script mode

The playground can execute raw deterministic snippets live in the browser using
`ProgramArtifact.v2` script mode.

This is best for:

- small deterministic examples,
- quick gas/result experiments,
- understanding profile differences.

### Certified example mode

The playground also ships prebuilt/certified artifacts for:

- the 10 canonical example categories,
- selected green ecosystem fixtures,
- selected red deterministic-failure fixtures,
- the flagship workload entry.

These examples are backed by generated JSON produced from in-repo fixtures and
runtime/build tooling.

## What uses prebuilt artifacts

The playground does **not** try to be a full npm-in-browser bundler.

For module-pack and library examples it uses:

- deterministic builder output,
- generated `ProgramArtifact.v2` payloads,
- certified evidence snapshots,
- generated OOG-boundary data.

That keeps the demo aligned with deterministic reality rather than inventing a
separate browser-only toolchain.

## Run it locally

```bash
git submodule update --init --recursive vendor/quickjs
bash tools/scripts/setup-emsdk.sh
bash apps/bluequickjs-playground/scripts/dev.sh
```

Open:

- `http://localhost:4325`

The dev script does three important things for a fresh checkout:

1. sources the pinned Emscripten environment,
2. builds the workspace libraries the playground depends on,
3. regenerates the playground’s evidence-backed JSON before starting Vite.

## Core UI areas

### Gallery and run-mode controls

The left side lets you switch between:

- Gallery
- Script
- Artifact JSON

It also exposes:

- execution profile selection,
- gas-limit presets,
- host preset selection,
- run action,
- exact OOG search,
- artifact/evidence export.

### Editor

The editor uses Monaco and adapts to the current mode:

- read-only source view for certified gallery examples,
- editable JavaScript in script mode,
- editable JSON in artifact-import mode.

### Result and evidence panel

The right side shows:

- result or error,
- gas used / remaining,
- result hash and tape hash,
- `engineBuildHash`,
- `gasVersion`,
- `executionProfile`,
- `sourceKind`,
- module graph hash where applicable,
- current/certified evidence comparison.

### Host and tape panel

The playground wraps its deterministic mock hosts to show:

- request inputs,
- response payload previews,
- units charged,
- tape metadata emitted by the runtime.

## Import/export behavior

- **Export artifact** downloads the current `ProgramArtifact.v2`.
- **Export run evidence** downloads the current browser run snapshot.
- **Artifact JSON mode** lets you paste an artifact and execute it with the
  selected host preset.

## Inspecting OOG boundaries

For supported examples, the **Find OOG boundary** action performs a deterministic
binary search over gas limits and displays:

- `firstSuccessGas`
- `lastFailureGas`
- success/failure gas used
- success/failure gas remaining
- failure code/tag

## Comparing to certified evidence

When an example is backed by generated evidence, the playground can show:

- certified snapshot,
- current browser run snapshot,
- a match/diff summary,
- source report reference,
- precomputed OOG boundary when available.

## Red fixture behavior

Red fixtures are intentionally educational. They explain:

- whether rejection happens at build or runtime,
- which deterministic rule is involved,
- where to read more in the docs.

The playground never tries to “paper over” those failures.

## Limitations

- Consensus-safe scope is still wasm-only (`wasm-node` vs `wasm-browser`).
- Native remains diagnostic-only.
- Runtime fetch/import/network behavior is intentionally unsupported.
- The playground is a deterministic learning/demo surface, not a general npm
  IDE or browser bundler.

## See also

- [Playground recipes](./playground-recipes.md)
- [Learning path](./learn/README.md)
- [Consensus-safe vs diagnostic-only](./consensus-safe-vs-diagnostic-only.md)
