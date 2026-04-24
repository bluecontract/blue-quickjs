# BlueQuickjs

BlueQuickjs is a deterministic JavaScript execution stack for consensus-critical workloads.
It runs a hardened QuickJS engine compiled to Wasm and is designed so independent runtimes
produce the same observable result for the same input:

- the returned value or error,
- gas used and gas remaining,
- the host-call tape,
- the exact out-of-gas boundaries.

## Consensus-safe scope

The current release makes a narrow, explicit consensus guarantee:

- **Executors:** `wasm-node` and `wasm-browser` must agree.
- **Engine artifact:** only the canonical `wasm32` release build is consensus-safe.
- **Required parity:** both executors must match exactly on:
  - returned value or error,
  - gas used,
  - gas remaining,
  - host-call tape,
  - out-of-gas boundary.
- **Native builds:** diagnostic-only unless a release policy explicitly promotes them.

Use these docs for the current release contract:

- [Consensus-safe vs diagnostic-only](docs/consensus-safe-vs-diagnostic-only.md)
- [Release policy](docs/release-policy.md)
- [HEAD verification note](docs/head-verification-note.md)

## What “deterministic” means here

For the same program, input, and gas limit, BlueQuickjs expects every consensus-safe executor to produce the same observable result:

- result bytes or deterministic error,
- gas used and gas remaining,
- host-call tape,
- Oexact out-of-gas transition point.

To make that repeatable, BlueQuickjs relies on pinned artifacts, explicit execution profiles, manifests, and generated verification evidence instead of environment-dependent runtime behavior.

## Execution profiles

Execution profiles define which JavaScript capabilities are available while preserving deterministic behavior.

| Profile | Best for | Scope |
| --- | --- | --- |
| `baseline-v1` | Minimal consensus execution | No async jobs, typed arrays, dynamic import, time, random, filesystem, or network access |
| `compat-general-v1` | General deterministic JavaScript | `baseline-v1` plus deterministic RegExp, Promise jobs, queueMicrotask, deterministic console output, and stable sort |
| `compat-binary-v1` | Binary-heavy workloads | `compat-general-v1` plus typed arrays, ArrayBuffer, DataView, and DV2 byte boundaries |

Profile details:

- [`docs/execution-profiles.md`](docs/execution-profiles.md)
- [`docs/determinism-profile.md`](docs/determinism-profile.md)

## 5-step first-success path

1. **Install Vdependencies + the pinned Wasm toolchain**

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

## Start here

### Learn the product

- [Documentation hub](docs/README.md)
- [Learning path](docs/learn/README.md)
- [Architecture overview](docs/architecture-overview.md)
- [Examples corpus](examples/README.md)
- [Glossary](docs/glossary.md)
- [FAQ](docs/faq.md)

### Use the product

- [Playground](docs/playground.md)
- [Playground recipes](docs/playground-recipes.md)
- [TypeScript SDK usage](docs/sdk.md)
- [Production embedder checklist](docs/production-embedder-checklist.md)

### Trust and verify the product

- [HEAD verification snapshot](docs/head-verification-note.md)
- [Workload certification](docs/workload-certification.md)
- [Ecosystem compatibility report](docs/ecosystem-compatibility-report.md)
- [Release-readiness report](docs/release-readiness-report.md)
- [Release checklist](docs/release-checklist.md)

## Consumer and operator proof paths

BlueQuickjs already exercises both public-consumer rehearsal flows:

- **tarball flow** — pack public tarballs and install them into the consumer
  proof app
- **registry/Verdaccio rehearsal flow** — publish to a local registry and run
  the same consumer proof against that path

See:

- [Workload certification](docs/workload-certification.md)
- [Release checklist](docs/release-checklist.md)

## QuickJS fork

- Patch series lives in `vendor/quickjs-patches/series`.
- `vendor/quickjs` is generated from upstream QuickJS base `e5fd3918c1c4a2ee39016e71b66a9eeda85ce716` plus that patch series.
- Fresh checkout: run `pnpm setup` or `bash tools/scripts/prepare-quickjs-source.sh`.
- Update fork behavior by exporting a new patch series and regenerating `vendor/quickjs`; do not commit generated QuickJS source.

## Workspace basics

- Install deps: `pnpm install`.
- Visualize projects: `pnpm nx graph`.
- Run tests across projects: `pnpm nx run-many -t test`.
- Apply lint fixes: `pnpm lint --fix`.

## Toolchain

Emscripten is pinned to `3.1.56`. For normal local setup, run `pnpm setup`;
it installs the pinned SDK and loads it for the setup flow. For manual shell
usage, source `tools/emsdk/emsdk_env.sh` before running Wasm build commands, or
wrap a one-off command with `tools/scripts/with-emsdk.sh`, for example:

```bash
tools/scripts/with-emsdk.sh pnpm nx build quickjs-wasm-build
```

See `docs/toolchain.md` for details and CI cache notes.

## Determinism checklist

- Same `(P, I, G)` yields identical result bytes, gas used/remaining, and
  host-call tape hashes across Node and browser.
- Deterministic capability profiles enforce explicit contracts per profile.
- Canonical gas is metered inside the engine, including host-call gas.
- DV and manifest hashes pin the host boundary contract.
- Release evidence is generated and verified, not hand-maintained.
