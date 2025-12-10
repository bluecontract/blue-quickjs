# Gas Schedule (Baseline #1)

Scope: define canonical gas units for QuickJS execution and host calls per Baseline #1 (e.g., §2B, §2C).

## Goals
- Enumerate opcode/builtin charges and allocation costs.
- Specify gas checkpoints (GC, job queue disabled) and deterministic accounting rules.
- Describe host-call gas: size-based charges + fixed overhead (cross-link with `host-call-abi.md`).

## To document (Baseline #1 refs)
- §2B: opcode metering and builtin charges.
- §2C: deterministic memory sizing and allocation gas mapping.
- §4.x: GC checkpoints / yielding strategy for Wasm/native parity.

## TODO
- Add concrete tables once the fork’s metering is implemented.
- Record any deviations from upstream QuickJS behaviors with rationale.
