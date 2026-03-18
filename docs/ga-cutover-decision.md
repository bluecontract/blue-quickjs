# GA cutover decision (wasm-consensus scope)

## Recommendation

Treat this release line as a **1.0.0 candidate for wasm-consensus scope**,
subject to final required-check enforcement and release-go/no-go signoff.

## Scope boundary

- In scope for 1.0.0 claim:
  - deterministic wasm consensus executors (`wasm-node`, `wasm-browser`),
  - strict value/error/gas/tape/OOG parity policy,
  - generated and verifiable release evidence.
- Out of scope for 1.0.0 claim:
  - native executor as a consensus gate (diagnostic-only unless explicitly
    certified and promoted later).

## Promotion prerequisites

- Required checks marked as branch protection gates.
- Release evidence verification and tamper detection job green.
- Consumer proof matrix and publish rehearsal green.
- Go/no-go template completed with signoffs.
