# quickjs-native-harness

Minimal native harness for the QuickJS fork. Builds a standalone binary that evaluates a JS string and returns deterministic output (`RESULT <json>` or `ERROR <message>`).

## Usage
- Build: `pnpm nx build quickjs-native-harness`
- Test: `pnpm nx test quickjs-native-harness`
- Manual run: `tools/quickjs-native-harness/dist/quickjs-native-harness --eval "1 + 2"`
- Gas goldens: `tools/quickjs-native-harness/scripts/gas-goldens.mjs` consumes fixtures under
  `tools/quickjs-native-harness/fixtures/gas` and is invoked by the test script.
- Parity report: `tools/quickjs-native-harness/scripts/parity-report.mjs` runs
  determinism/module-pack/binary fixture suites through wasm-node + native,
  emits signed JSON snapshots, and supports:
  - `--out <path>` write report artifact,
  - `--assert-match` fail when node/native snapshots diverge,
  - `--ignore-gas` compare only result/error/tape fields while still reporting
    gas deltas,
  - `--gas-delta-baseline <path>` require per-fixture gas deltas to match an
    expected baseline file,
  - `--write-gas-delta-baseline <path>` emit the current gas delta baseline,
  - `--include-gas-trace` attach node/native gas-trace counters and
    per-counter deltas to each fixture in the report output (this mode disables
    gas-delta baseline enforcement because gas tracing perturbs counters), plus
    an aggregated `gasTraceSummary` section ranking hottest counter deltas and
    top fixtures by allocation-gas drift and residual untraced gas delta
    (including host-call pre/post gas counters, residual signature histograms,
    and profile rollups),
  - `--compare <report.json>` compare current run against a prior report.
  The harness test script runs this report in `--assert-match` mode with
  `--gas-delta-baseline` as part of
  `pnpm nx test quickjs-native-harness`.
- Manifest validation: pass `--abi-manifest-hex <hex>` (or `--abi-manifest-hex-file <path>`) and
  `--abi-manifest-hash <sha256-hex>` to initialize the VM with a pinned ABI manifest. An optional
  `--context-blob-hex <hex>` can be provided for future context blobs.
- Execution profile: `--execution-profile baseline-v1|compat-regexp-v1|compat-general-v1|compat-binary-v1`
  selects deterministic feature flags for initialization (`baseline-v1` is the default).
- Module-pack eval: `--module-entry-specifier <specifier>` plus either
  `--module-pack-json "<json-array>"` or `--module-pack-file <path>` executes
  deterministic static ESM module packs; `--module-entry-export <name>` selects
  the exported binding (defaults to `default`).
- Parity eval mode: `--parity-eval` (eval-mode only) routes script evaluation
  through a DV encode/decode path so parity tooling can mirror wasm runtime
  evaluation semantics while keeping human-readable `RESULT <json>` output.
- Tape reporting: `--report-tape` appends host tape JSON (`TAPE [...]`) to
  output lines for parity checks.
- SHA helper: `--sha256-hex <hex>` prints the SHA-256 digest for the provided hex bytes (handy for
  cross-checking vectors).

Notes:
- Uses the fork's deterministic init (`JS_NewDeterministicRuntime`): baseline
  global scope excludes `Date`, `eval`, `Function`, `Proxy`, `RegExp`, typed
  arrays, `Promise`/`WeakRef` and reserves a null-prototype `Host.v1`
  placeholder. `compat-general-v1` / `compat-binary-v1` enable Promise jobs,
  deterministic `queueMicrotask`, console shim routing via `Host.v1.emit`, and
  deterministic stable `Array.prototype.sort`. `compat-binary-v1` additionally
  enables typed-array intrinsics so Host.v2/DV2 byte-string boundaries roundtrip
  via `Uint8Array`.
- Build artifacts live under `tools/quickjs-native-harness/dist`.
