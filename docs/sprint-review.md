# Sprint review: deterministic QuickJS in Wasm (Node + Web parity)

This doc is based on `docs/implementation-plan.md` and the normative docs in `docs/`.

## Context and goals

- Baseline 1: deterministic QuickJS evaluation with canonical gas metering in Wasm.
- Baseline 2: manifest-locked host ABI with numeric function ids and DV encoding.
- Outcome: same wasm evaluator and gas numbers in Node and browser, with fixtures that must match.

## What we can demo

- Node smoke tests validate deterministic outputs, gas usage, and host-call tape hashes.
- Browser smoke tests run the same fixtures in wasm, then compare to Node results.
- Gas samples include repeat-in-same-context checks to prove stable gas accounting.

## Evidence: parity fixtures (expected baselines)

Determinism fixtures (gas limit 50,000):

| fixture | result | gas used | gas remaining | tape length |
| --- | --- | --- | --- | --- |
| doc-read | ok | 1242 | 48758 | 1 |
| doc-canonical | ok | 1211 | 48789 | 1 |
| multi-host | ok | 2276 | 47724 | 4 |
| canon-ops | ok | 1932 | 48068 | 0 |
| host-error | error: NOT_FOUND | 771 | 49229 | 1 |

Gas sample fixtures (gas limit 1,000,000):

| fixture | gas used | gas remaining | notes |
| --- | --- | --- | --- |
| return-1 | 179 | 999821 | |
| loop-1k | 17347 | 982653 | |
| loop-10k | 170347 | 829653 | repeat same-context: 5 runs, all 170347 |
| string-concat | 61139 | 938861 | |
| object-alloc | 51115 | 948885 | |
| array-ops | 40203 | 959797 | |

These baselines live in the fixture sources and are enforced by both Node and browser tests.

## How the tests enforce parity

- Node smoke tests compare each fixture to its expected baseline values.
  - `apps/smoke-node/src/lib/determinism.spec.ts`
  - `apps/smoke-node/src/lib/gas-samples.spec.ts`
- Browser tests run the same fixtures in wasm, capture results in the page, then compare:
  - Node results vs expected baselines
  - Browser results vs Node results
  - `apps/smoke-web/tests/determinism.spec.ts`
  - `apps/smoke-web/tests/gas-samples.spec.ts`
- Determinism fixtures also hash the host-call tape to prove identical call sequences.

## Concepts to explain during review

### ABI (Host.v1 manifest + host_call)

- A single syscall import, `host_call`, dispatches all host capabilities by numeric `fn_id`.
- The ABI manifest maps `fn_id` to `Host.v1` JS paths, arg schemas, gas parameters, and limits.
- Requests and responses are DV-encoded bytes.
- Response envelope is `{ ok, units }` or `{ err, units }`; error codes are validated against the manifest.
- Gas for host calls uses two-phase charging from the manifest:
  - pre-charge: `base + k_arg_bytes * request_bytes`
  - post-charge: `k_ret_bytes * response_bytes + k_units * units`

### DV (Deterministic Value)

- DV is a canonical CBOR subset: null, booleans, finite numbers, UTF-8 strings, arrays, and objects.
- Numbers must be safe integers or float64; reject NaN/Inf and canonicalize -0 to 0.
- Objects require string keys sorted by CBOR key ordering; no duplicate keys.
- DV is used for ABI requests/responses, manifest hashing, and fixture hashing.

### Limits

Global DV caps (defaults):

- Max encoded bytes: 1 MiB
- Max depth: 64
- Max string bytes: 256 KiB
- Max array items / map entries: 65,535

Per-function limits in the Host.v1 fixture manifest:

- `document.get` and `document.getCanonical`:
  - max_request_bytes 4096
  - max_response_bytes 262144
  - max_units 1000
  - arg_utf8_max 2048
- `emit`:
  - max_request_bytes 32768
  - max_response_bytes 64
  - max_units 1024

### Gas metering

- Gas is metered inside QuickJS for opcodes, builtins, and allocations.
- Allocation gas: base 3 per allocation, plus 1 gas per 16 bytes.
- GC is deterministic: automatic GC is disabled and runs at checkpoints; GC itself costs 0 gas.
- Each eval runs with a gas limit and returns gas used and remaining.

## Demo script (optional)

- Node tests: `pnpm nx test smoke-node`
- Browser tests: `pnpm nx run smoke-web:e2e` (starts Vite on http://localhost:4300)
- Manual pages (optional):
  - `pnpm --dir apps/smoke-web vite --host --port 4300 --config vite.config.mts`
  - open `/determinism.html` and `/gas-samples.html`

## Key sources

- Plan: `docs/implementation-plan.md`
- ABI and DV: `docs/abi-manifest.md`, `docs/host-call-abi.md`, `docs/dv-wire-format.md`
- Gas rules: `docs/gas-schedule.md`, `docs/wasm-gas-harness.md`
- Fixtures: `libs/test-harness/src/lib/determinism-fixtures.ts`, `libs/test-harness/src/lib/gas-fixtures.ts`
