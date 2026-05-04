# Core Concepts

BlueQuickjs is an artifact, runtime, and evidence system.

## Artifact

A `ProgramArtifact.v2` pins the source, execution profile, ABI identity, engine
build hash, and gas schedule. Consensus execution should use artifacts, not ad
hoc source strings.

See [ProgramArtifact.v2](./program-artifact-v2.md).

## Runtime

The consensus runtime is the canonical wasm32 QuickJS build. The current
consensus-safe executors are:

- `wasm-node`
- `wasm-browser`

Native tools are useful for diagnostics, but they are not consensus-safe unless
a release policy explicitly promotes them.

See [Consensus-safe vs diagnostic-only](./consensus-safe-vs-diagnostic-only.md).

## Profiles

Execution profiles control which JavaScript capabilities are enabled:

- `baseline-v1`: smallest deterministic surface.
- `compat-general-v1`: deterministic general JS features such as Promise jobs.
- `compat-binary-v1`: binary APIs and DV2 byte boundaries.

See [Execution profiles](./execution-profiles.md).

## Gas

Gas is charged inside the engine and is part of the consensus result. Matching
value is not enough; gas used, gas remaining, and the exact out-of-gas boundary
must match too.

See [Gas schedule](./gas-schedule.md).

## Host ABI

External capabilities cross a manifest-locked host boundary. Host values use
canonical DV/DV2 encoding, and host calls are metered and recorded in the
host-call tape.

See [Host call ABI](./host-call-abi.md), [ABI manifest](./abi-manifest.md), and
[DV wire format](./dv-wire-format.md).

## Evidence

Generated evidence is the source of truth for release claims. Human summaries
should point to generated reports rather than restating the same facts by hand.

See [HEAD verification note](./head-verification-note.md) and
[Release provenance](./release-provenance.md).
