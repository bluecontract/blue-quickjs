# Release notes draft — wasm-consensus GA readiness

Date: 2026-03-18  
Scope: wasm-consensus release line (`wasm-node` + `wasm-browser`), native
diagnostic path retained as non-consensus.

## Highlights

- Consensus policy now treats **exact gas** and **exact OOG boundaries** as
  release-critical alongside value/error/tape parity.
- Workload certification includes:
  - flagship knowledge/compliance workload,
  - green ecosystem compatibility corpus,
  - deterministic red-boundary scenarios,
  - builder determinism evidence,
  - downstream consumer reproducibility proof.
- Release workflows archive strict parity and workload/consumer evidence.

## Consensus-safe scope (shipped)

- Supported consensus executors:
  - `wasm-node`
  - `wasm-browser`
- Required parity dimensions:
  - result/error
  - gas used + gas remaining
  - host-call tape
  - exact first-success / last-failure OOG boundary

## Unsupported / intentionally constrained behavior

- Dynamic code generation (`eval`, `Function`) remains disabled.
- Ambient nondeterministic APIs (time/random/timers/fs/network) remain outside
  deterministic contract.
- Compatibility surfaces are profile-gated:
  - `baseline-v1`
  - `compat-general-v1`
  - `compat-binary-v1`

## Native status

- Native harness remains **diagnostic-only** by default.
- Native parity reports are archived for diagnostics; they are not consensus
  release gates unless policy explicitly promotes native to a consensus
  executor.

## Breaking-change and migration notes

- Deterministic consumers should continue pinning:
  - `engineBuildHash`,
  - `gasVersion`,
  - ABI manifest hash,
  - execution profile.
- No migration is required for consumers already pinned to release-mode
  `ProgramArtifact.v2` and consensus policy checks.

## Evidence links

- Release readiness report: `docs/release-readiness-report.md`
- Workload certification report: `docs/workload-certification.md`
- Ecosystem compatibility report: `docs/ecosystem-compatibility-report.md`
- Release policy: `docs/release-policy.md`
