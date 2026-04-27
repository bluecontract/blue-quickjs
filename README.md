# BlueQuickjs

BlueQuickjs is a deterministic JavaScript execution stack for
consensus-critical workloads. It runs a hardened QuickJS engine compiled to
Wasm and is designed so independent runtimes produce the same observable result
for the same input:

- returned value or error,
- gas used and gas remaining,
- host-call tape,
- exact out-of-gas boundary.

## Quick Start

1. **Install dependencies and the pinned Wasm toolchain**

   ```bash
   pnpm run setup
   ```

2. **Run the current consensus smoke checks**

   ```bash
   pnpm verify
   ```

3. **Generate parity and certification evidence**

   ```bash
   pnpm evidence
   ```

4. **Verify the release evidence bundle**

   ```bash
   pnpm evidence:verify
   ```

5. **Open the in-repo browser playground**

   ```bash
   pnpm run playground
   ```

## Read Next

- [Docs index](docs/README.md)
- [Core concepts](docs/concepts.md)
- [TypeScript SDK usage](docs/sdk.md)
- [Production embedder checklist](docs/production-embedder-checklist.md)
- [Examples corpus](examples/README.md)

## Consensus Scope

The current release makes a narrow, explicit consensus guarantee:

- `wasm-node` and `wasm-browser` must agree.
- Only the canonical `wasm32` release build is consensus-safe.
- Native builds are diagnostic-only unless release policy explicitly promotes
  them.

The consensus result includes returned value or error, gas used and remaining,
host-call tape, and the exact out-of-gas boundary.

## Execution Profiles

| Profile | Use when |
| --- | --- |
| `baseline-v1` | You need the smallest deterministic JS surface. |
| `compat-general-v1` | You need deterministic RegExp, Promise jobs, console output, or stable sort. |
| `compat-binary-v1` | You need typed arrays, `ArrayBuffer`, `DataView`, or DV2 byte boundaries. |

Details: [Execution profiles](docs/execution-profiles.md).

## Consumer and operator proof paths

BlueQuickjs exercises two public-consumer rehearsal flows:

- **tarball flow**: pack public tarballs and install them into the consumer
  proof app.
- **registry/Verdaccio rehearsal flow**: publish to a local registry and run the
  same consumer proof against that path.

See [Workload certification](docs/workload-certification.md) and
[Release checklist](docs/release-checklist.md).

## QuickJS fork

- Patch series lives in `vendor/quickjs-patches/series`.
- `vendor/quickjs` is generated from upstream QuickJS base
  `e5fd3918c1c4a2ee39016e71b66a9eeda85ce716` plus that patch series.
- Fresh checkout: run `pnpm setup` or
  `bash tools/scripts/prepare-quickjs-source.sh`.
- Update fork behavior by exporting a new patch series and regenerating
  `vendor/quickjs`; do not commit generated QuickJS source.

## Workspace basics

- Install deps: `pnpm install`.
- Visualize projects: `pnpm nx graph`.
- Run tests across projects: `pnpm nx run-many -t test`.
- Apply lint fixes: `pnpm lint --fix`.

## Toolchain

Emscripten is pinned to `3.1.56`. For normal local setup, run `pnpm setup`; it
installs the pinned SDK and loads it for the setup flow. For manual shell usage,
source `tools/emsdk/emsdk_env.sh` before running Wasm build commands, or wrap a
one-off command with `tools/scripts/with-emsdk.sh`, for example:

```bash
tools/scripts/with-emsdk.sh pnpm nx build quickjs-wasm-build
```

See [Toolchain](docs/toolchain.md) for details and CI cache notes.

## Determinism checklist

- Same `(P, I, G)` yields identical result bytes, gas used and remaining, and
  host-call tape hashes across Node and browser.
- Deterministic capability profiles enforce explicit contracts per profile.
- Canonical gas is metered inside the engine, including host-call gas.
- DV and manifest hashes pin the host boundary contract.
- Release evidence is generated and verified, not hand-maintained.
