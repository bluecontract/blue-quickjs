# BlueQuickjs

Deterministic QuickJS-in-Wasm evaluator monorepo (Nx + pnpm), tracking a hardened QuickJS fork and SDK/tooling to run it.

## What is consensus-safe today?

- **Consensus-safe executor matrix (release gate):**
  - `wasm-node` (canonical `wasm32` release artifact)
  - `wasm-browser` (same pinned canonical `wasm32` release artifact)
- **Diagnostic-only by default:** native harness (`tools/quickjs-native-harness`)
  unless a release explicitly promotes native to consensus with strict parity
  evidence.

## Execution profile surface (at a glance)

- `baseline-v1`: strict deterministic baseline (no Promise jobs/microtasks,
  no typed arrays/binary boundary, no ambient nondeterministic APIs).
- `compat-general-v1`: baseline + deterministic Promise jobs,
  `queueMicrotask`, stable sort, console shim, RegExp compatibility.
- `compat-binary-v1`: compat-general + typed arrays / ArrayBuffer / DataView +
  Host.v2/DV2 byte-boundary support.

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

## Docs

- Baselines (start here):
  - Baseline #1 — Deterministic execution + canonical gas: `docs/baseline-1.md`
  - Baseline #2 — Host ABI (manifest-locked) + DV wire format: `docs/baseline-2.md`
- Determinism profile: `docs/determinism-profile.md`
- Gas schedule: `docs/gas-schedule.md`
- DV wire format: `docs/dv-wire-format.md`
- Program artifact v2: `docs/program-artifact-v2.md`
- Module pack v1: `docs/module-pack.md`
- Execution profiles: `docs/execution-profiles.md`
- Deterministic builder: `docs/builder.md`
- Value model v2 (DV2): `docs/value-model-v2.md`
- Embedder integration: `docs/embedders.md`
- ABI manifest: `docs/abi-manifest.md`
- Host call ABI: `docs/host-call-abi.md`
- Release policy: `docs/release-policy.md`
- Release checklist: `docs/release-checklist.md`
- Examples guide: `docs/examples.md`
- Release-readiness evidence report: `docs/release-readiness-report.md`

## Determinism checklist

- Same `(P, I, G)` yields identical result bytes, gas used/remaining, and host-call tape hashes across Node and browser.
- Deterministic capability profiles: baseline stays strict; compatibility profiles (`compat-general-v1`, `compat-binary-v1`) selectively re-enable deterministic subsets (`docs/determinism-profile.md`, `docs/execution-profiles.md`).
- Canonical gas: opcode/builtin/allocation/GC charges plus two-phase host-call gas (`docs/gas-schedule.md`).
- DV and manifest: canonical DV encoding, safe numeric range, sorted keys, size caps, manifest hash pinning (`docs/dv-wire-format.md`, `docs/abi-manifest.md`).
- Host ABI: `host_call` envelope, deterministic error mapping, and reentrancy rules (`docs/host-call-abi.md`).
