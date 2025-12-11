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

## Allocation and GC

### Allocation gas

Allocations are charged per requested byte:
- Base charge: `JS_GAS_ALLOC_BASE = 3` per allocation.
- Byte charge: `1` gas unit per `16` bytes (`JS_GAS_ALLOC_PER_BYTE_SHIFT = 4`).

### Garbage collection (GC)

- Automatic GC heuristics are disabled in deterministic mode (`js_trigger_gc` is a no-op and GC threshold set to `-1`).
- GC runs only at explicit checkpoints (currently pre/post eval in the native harness; host-call checkpoints to be added with the host ABI).
- GC itself is free (0 gas); its cost is amortized into allocation gas.
- A deterministic counter tracks requested allocation bytes; exceeding `JS_DET_GC_THRESHOLD_BYTES = 512 KiB` sets `det_gc_pending`. The next checkpoint runs GC if the flag is set and then clears the counter/flag. This keeps GC frequency proportional to allocation pressure while staying deterministic across native/Wasm.
