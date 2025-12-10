# Determinism Profile (Baseline #1)

Scope: capture the deterministic VM configuration required by Baseline #1 (e.g., §1B–§1C, §3) for both native and Wasm builds.

## Goals
- Document forbidden globals and stubs (time, randomness, locale, async, host IO).
- Describe the deterministic init entrypoint and required runtime flags.
- Note any QuickJS fork changes that enforce determinism.

## To document (Baseline #1 refs)
- §1B/§1C: removed or stubbed globals (Date, timers, Promise, locale-dependent APIs).
- §3: disabled features (eval/Function, TypedArray/WebAssembly, streams) and error semantics.
- §2C: deterministic memory sizing assumptions for Wasm.
- §4.x: gas-related deterministic checkpoints (cross-link with `gas-schedule.md`).

## TODO
- Fill concrete lists once fork changes land.
- Add test matrix references from `test-harness`.
