# BlueQuickjs

BlueQuickjs is a deterministic JavaScript execution engine built on a hardened
QuickJS runtime compiled to Wasm. It is designed for **consensus-critical
execution** where result bytes, gas accounting, host-call tape, and OOG
boundaries must be reproducible across environments.

## Consensus-safe scope (today)

- Consensus executors: **`wasm-node` vs `wasm-browser`** (canonical `wasm32` release artifact).
- Release gates require exact parity for:
  - value/error result,
  - gas used and gas remaining,
  - host-call tape evidence,
  - first-success/last-failure OOG boundaries.
- Native harness remains **diagnostic-only** unless explicitly promoted by
  release policy.

See:
- Release policy: [`docs/release-policy.md`](docs/release-policy.md)
- Workload certification: [`docs/workload-certification.md`](docs/workload-certification.md)
- Ecosystem compatibility: [`docs/ecosystem-compatibility-report.md`](docs/ecosystem-compatibility-report.md)
- Release evidence: [`docs/release-readiness-report.md`](docs/release-readiness-report.md)

## Execution profiles

| Profile | Purpose | Deterministic capability scope |
| --- | --- | --- |
| `baseline-v1` | Minimal consensus baseline | No Promise jobs/microtasks, no typed arrays/ArrayBuffer/DataView, no dynamic import/time/random/fs/network |
| `compat-general-v1` | Real-world JS compatibility | `baseline-v1` + deterministic RegExp + Promise jobs + `queueMicrotask` + deterministic console shim + stable sort |
| `compat-binary-v1` | Binary-heavy deterministic workloads | `compat-general-v1` + typed arrays/ArrayBuffer/DataView + DV2 bytes boundary |

Profile details:
- [`docs/execution-profiles.md`](docs/execution-profiles.md)
- [`docs/determinism-profile.md`](docs/determinism-profile.md)

## 3-step quickstart

1. **Install dependencies + pinned Wasm toolchain**

   ```bash
   pnpm install
   bash tools/scripts/setup-emsdk.sh
   source tools/emsdk/emsdk_env.sh
   ```

2. **Run consensus smoke checks**

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

## Start here

- Documentation index: [`docs/README.md`](docs/README.md)
- Head verification snapshot: [`docs/head-verification-note.md`](docs/head-verification-note.md)
- Examples corpus: [`examples/README.md`](examples/README.md)
- Workload certification plan: [`docs/workload-certification-plan.md`](docs/workload-certification-plan.md)
- Production embedder checklist: [`docs/production-embedder-checklist.md`](docs/production-embedder-checklist.md)
- Local auditor verification command:
  `pnpm release-evidence:verify -- --evidence-dir artifacts/release-evidence`

---

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

- Emscripten is pinned to `3.1.56`; install via `tools/scripts/setup-emsdk.sh`, then `source tools/emsdk/emsdk_env.sh`. See `docs/toolchain.md` for details and CI cache notes.

## Determinism checklist

- Same `(P, I, G)` yields identical result bytes, gas used/remaining, and host-call tape hashes across Node and browser.
- Deterministic capability profiles enforce explicit contracts per profile (`docs/determinism-profile.md`, `docs/execution-profiles.md`).
- Canonical gas: opcode/builtin/allocation/GC charges plus two-phase host-call gas (`docs/gas-schedule.md`).
- DV and manifest: canonical DV encoding, safe numeric range, sorted keys, size caps, manifest hash pinning (`docs/dv-wire-format.md`, `docs/abi-manifest.md`).
- Host ABI: `host_call` envelope, deterministic error mapping, and reentrancy rules (`docs/host-call-abi.md`).
