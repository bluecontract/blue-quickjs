# BlueQuickjs

BlueQuickjs is a deterministic JavaScript execution stack built on a hardened
QuickJS engine compiled to Wasm. It is designed for **consensus-critical
execution** where independent runtimes must agree on:

- value or error,
- gas used and gas remaining,
- host-call tape,
- exact out-of-gas boundaries.

## Consensus-safe scope

Current consensus-safe release scope is intentionally explicit:

- **consensus executors:** `wasm-node` vs `wasm-browser`
- **canonical engine:** `wasm32` release artifact only
- **release-critical parity:** exact
  - value/error parity,
  - gas used parity,
  - gas remaining parity,
  - host-call tape parity,
  - OOG boundary parity
- **native status:** diagnostic-only unless separately promoted by policy

Use these docs for the current release contract:

- [Consensus-safe vs diagnostic-only](docs/consensus-safe-vs-diagnostic-only.md)
- [Release policy](docs/release-policy.md)
- [HEAD verification note](docs/head-verification-note.md)

## What “deterministic” means here

For a fixed program artifact `P`, input envelope `I`, and gas limit `G`,
BlueQuickjs expects the same consensus executors to produce the same:

- result bytes or deterministic error,
- gas accounting,
- host-call tape,
- OOG transition point.

That is why the product centers on pinned artifacts, profiles, manifests, and
generated evidence instead of ad hoc runtime behavior.

## Execution profiles

| Profile | Purpose | Deterministic capability scope |
| --- | --- | --- |
| `baseline-v1` | Minimal consensus baseline | No Promise jobs/microtasks, no typed arrays/ArrayBuffer/DataView, no dynamic import/time/random/fs/network |
| `compat-general-v1` | Real-world JS compatibility | `baseline-v1` + deterministic RegExp + Promise jobs + `queueMicrotask` + deterministic console shim + stable sort |
| `compat-binary-v1` | Binary-heavy deterministic workloads | `compat-general-v1` + typed arrays/ArrayBuffer/DataView + DV2 bytes boundary |

Profile details:

- [`docs/execution-profiles.md`](docs/execution-profiles.md)
- [`docs/determinism-profile.md`](docs/determinism-profile.md)

## 5-step first-success path

1. **Install dependencies + the pinned Wasm toolchain**

   ```bash
   pnpm install
   bash tools/scripts/setup-emsdk.sh
   source tools/emsdk/emsdk_env.sh
   ```

2. **Run the current consensus smoke checks**

   ```bash
   pnpm exec playwright install --with-deps chromium
   source tools/emsdk/emsdk_env.sh
   pnpm nx test smoke-node
   pnpm nx run smoke-web:e2e
   ```

3. **Generate parity and certification evidence**

   ```bash
   source tools/emsdk/emsdk_env.sh
   node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs --out-dir artifacts/reproducibility-consensus
   node apps/ecosystem-certifier/scripts/archive-workload-certification-report.mjs --out-dir artifacts/workload-certification
   ```

4. **Verify the release evidence bundle**

   ```bash
   pnpm release-evidence:synthesize -- --out-dir artifacts/release-evidence
   pnpm release-evidence:verify -- --evidence-dir artifacts/release-evidence
   ```

5. **Open the in-repo browser playground**

   ```bash
   bash apps/bluequickjs-playground/scripts/dev.sh
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

- Submodule at `vendor/quickjs` (origin `git@github.com:bluecontract/quickjs.git`).
- Fresh checkout: `git submodule update --init --recursive`.
- Update the pin after landing changes in the fork: `cd vendor/quickjs && git fetch origin && git checkout <new-ref>` then `cd .. && git add vendor/quickjs && git commit -m "chore: bump quickjs submodule"`.
- Do QuickJS edits in the fork repository and only commit the pinned SHA here.

## Workspace basics

- Install deps: `pnpm install`.
- Visualize projects: `pnpm nx graph`.
- Run tests across projects: `pnpm nx run-many -t test`.
- Apply lint fixes: `pnpm lint --fix`.

## Toolchain

- Emscripten is pinned to `3.1.56`; install via `tools/scripts/setup-emsdk.sh`,
  then `source tools/emsdk/emsdk_env.sh`. See `docs/toolchain.md` for details
  and CI cache notes.

## Determinism checklist

- Same `(P, I, G)` yields identical result bytes, gas used/remaining, and
  host-call tape hashes across Node and browser.
- Deterministic capability profiles enforce explicit contracts per profile.
- Canonical gas is metered inside the engine, including host-call gas.
- DV and manifest hashes pin the host boundary contract.
- Release evidence is generated and verified, not hand-maintained.
