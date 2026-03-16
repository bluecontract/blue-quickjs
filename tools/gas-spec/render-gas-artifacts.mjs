#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const specPath = path.join(__dirname, 'gas-spec.v3.json');
const gasScheduleDocPath = path.join(repoRoot, 'docs', 'gas-schedule.md');

const CHECK_MODE = process.argv.includes('--check');

function renderGasSchedule(spec) {
  return `# Gas Schedule (Baseline #1)

> This file is generated from \`tools/gas-spec/gas-spec.v3.json\`.
> Update the gas spec source and rerun \`node tools/gas-spec/render-gas-artifacts.mjs\`.

Baseline anchor: see \`docs/baseline-1.md\` (determinism + canonical gas) and \`docs/baseline-2.md\` (host-call ABI/gas parameters).

Scope: define canonical gas units for QuickJS execution and host calls per Baseline #1. This document is normative and must match harness assertions.

## Gas version and limits

- \`JS_GAS_VERSION_LATEST = ${spec.gasVersion}\`
- Gas amounts are uint64.
- \`JS_GAS_UNLIMITED\` disables charging and reports gas used as 0.
- \`JS_UseGas\` subtracts from \`gas_remaining\`; if \`amount > gas_remaining\`, it sets \`gas_remaining = 0\` and throws an uncatchable \`OutOfGas: out of gas\` error.

## Opcode gas

- Every bytecode opcode defined in \`quickjs-opcode.h\` costs \`${spec.opcode.defaultDispatchCost}\` gas per dispatch.
- Temporary or unknown opcodes (outside \`OP_COUNT\`) cost \`0\`.

## Builtin callback gas

The following array methods charge deterministic callback gas: ${spec.arrayCallback.methods
    .map((method) => `\`${method}\``)
    .join(', ')}${
      spec.arrayCallback.includesTypedArrays
        ? ' (including typed arrays).'
        : '.'
    }

Charges:

- Base: \`JS_GAS_ARRAY_CB_BASE = ${spec.arrayCallback.base}\` once per call, before the loop starts.
- Per element: \`JS_GAS_ARRAY_CB_PER_ELEMENT = ${spec.arrayCallback.perElement}\` before each element is processed.

The per-element charge is applied for each iteration step, even when a hole is skipped or a callback returns early.

## Allocation gas

Each allocation charges:

- Base: \`JS_GAS_ALLOC_BASE = ${spec.allocation.base}\`
- Byte charge: \`1\` gas per \`${2 ** spec.allocation.perByteShift}\` requested bytes (\`JS_GAS_ALLOC_PER_BYTE_SHIFT = ${spec.allocation.perByteShift}\`)

Formula:

- \`JS_GAS_ALLOC_BASE + ceil(size / ${2 ** spec.allocation.perByteShift})\` where \`size\` is the requested allocation size.

Current deterministic normalization model:

- Mode: \`${spec.allocation.normalization.mode}\`
- Note: ${spec.allocation.normalization.notes}
${
    spec.allocation.normalization.mode === 'legacy-64bit-26-31'
      ? `- 64-bit path: \`normalized_size = floor((size * ${spec.allocation.normalization.numerator} + ${spec.allocation.normalization.offset}) / ${spec.allocation.normalization.denominator})\``
      : '- No pointer-width normalization is applied.'
  }

Canonical allocation classes (width-independent charged-byte formulas):

- Object header: \`${spec.allocation.canonicalClasses.objectHeaderBytes}\`
- Property slot: \`${spec.allocation.canonicalClasses.propertySlotBytes}\`
- Shape header: \`${spec.allocation.canonicalClasses.shapeHeaderBytes}\`
- Shape property entry: \`${spec.allocation.canonicalClasses.shapePropertyBytes}\`
- String header: \`${spec.allocation.canonicalClasses.stringHeaderBytes}\`
- Array slot: \`${spec.allocation.canonicalClasses.arraySlotBytes}\`
- Module record: \`${spec.allocation.canonicalClasses.moduleRecordBytes}\`
- Module entry: \`${spec.allocation.canonicalClasses.moduleEntryBytes}\`
- Promise/job base: \`${spec.allocation.canonicalClasses.promiseJobBaseBytes}\`
- Promise/job arg unit: \`${spec.allocation.canonicalClasses.promiseJobArgBytes}\`
- ArrayBuffer header: \`${spec.allocation.canonicalClasses.arrayBufferHeaderBytes}\`
- TypedArray backing unit: \`${spec.allocation.canonicalClasses.typedArrayBackingUnitBytes}\`
- TypedArray record: \`${spec.allocation.canonicalClasses.typedArrayRecordBytes}\`

## Deterministic JSON builtin gas

Deterministic mode exposes metered \`JSON.parse\` / \`JSON.stringify\` built-ins. These
charges apply only to those deterministic wrappers; they do **not** change the behavior
of the public C APIs \`JS_ParseJSON*\` / \`JS_JSONStringify\` used by non-deterministic
contexts or host-side helpers.

### \`JSON.parse\`

Charges:

- Base: \`JS_GAS_JSON_PARSE_BASE = ${spec.jsonParse.base}\`
- Input bytes: \`JS_GAS_JSON_PARSE_INPUT_BYTE = ${spec.jsonParse.inputByte}\`
- Value visit: \`JS_GAS_JSON_PARSE_VALUE = ${spec.jsonParse.value}\`
- Object entry: \`JS_GAS_JSON_PARSE_OBJECT_ENTRY = ${spec.jsonParse.objectEntry}\`
- Array element: \`JS_GAS_JSON_PARSE_ARRAY_ELEMENT = ${spec.jsonParse.arrayElement}\`

Interpretation:

- Base is charged once per call, before deterministic argument validation finishes.
- Input-byte gas is charged on the UTF-8 byte length of the input string before the
  parser runs.
- The deterministic wrapper performs a metered structural preflight on the JSON text
  before calling \`JS_ParseJSON\`, charging \`VALUE\`, \`OBJECT_ENTRY\`, and
  \`ARRAY_ELEMENT\` as it validates the deterministic subset and size limits.
- Limit/type/syntax failures consume the work charged before the failure point; the
  full native parse does not run after a failing preflight.

### \`JSON.stringify\`

Charges:

- Base: \`JS_GAS_JSON_STRINGIFY_BASE = ${spec.jsonStringify.base}\`
- Value visit: \`JS_GAS_JSON_STRINGIFY_VALUE = ${spec.jsonStringify.value}\`
- Object entry: \`JS_GAS_JSON_STRINGIFY_OBJECT_ENTRY = ${spec.jsonStringify.objectEntry}\`
- Array element: \`JS_GAS_JSON_STRINGIFY_ARRAY_ELEMENT = ${spec.jsonStringify.arrayElement}\`
- Output bytes: \`JS_GAS_JSON_STRINGIFY_OUTPUT_BYTE = ${spec.jsonStringify.outputByte}\`
- Key sort comparison: \`JS_GAS_JSON_STRINGIFY_SORT_COMPARISON = ${spec.jsonStringify.sortComparison}\`

Interpretation:

- Base is charged once per call, before deterministic option validation finishes.
- \`VALUE\`, \`OBJECT_ENTRY\`, and \`ARRAY_ELEMENT\` are charged during the recursive walk.
- \`OUTPUT_BYTE\` is charged on emitted UTF-8 bytes of the final JSON string.
- \`SORT_COMPARISON\` is charged for each comparison performed by the deterministic key
  sorter used for canonical object key ordering.
- Unsupported values/options and cycle errors still consume the work charged before the
  failure point.

## Garbage collection (GC) checkpoints

- Automatic GC heuristics are disabled in deterministic mode (\`js_trigger_gc\` is a no-op and GC threshold is set to \`-1\`).
- A deterministic counter tracks charged allocation bytes. When it reaches \`JS_DET_GC_THRESHOLD_BYTES = ${spec.gc.deterministicThresholdBytes}\`, \`det_gc_pending\` is set.
- \`JS_RunGCCheckpoint(ctx)\` runs GC only when \`det_gc_pending\` is set; it then clears the flag and counter.
- GC costs \`0\` gas; allocation gas amortizes it.
- Checkpoints are invoked at deterministic points (pre/post eval and around host calls).

## Host-call gas (Baseline #2)

Host-call gas uses parameters from the ABI manifest \`gas\` fields (see \`docs/abi-manifest.md\`).

- Pre-charge before the host call:
  - \`${spec.hostCall.formula.pre}\`
- Post-charge after response parse:
  - \`${spec.hostCall.formula.post}\`

Where:

- \`request_bytes\` is the encoded DV args array.
- \`response_bytes\` is the encoded DV response envelope.

Overflow during charge throws \`${spec.hostCall.overflowError}\`. OOG on pre-charge aborts before the host call executes; OOG on post-charge aborts after response parse with host effects already applied.

## Gas trace (optional)

- \`JS_EnableGasTrace\` reports aggregate counts for:
  - opcode gas,
  - array callback gas,
  - allocation gas,
  - deterministic \`JSON.parse\` gas,
  - deterministic \`JSON.stringify\` gas.
- Host-call gas is billed and tracked in dedicated host pre/post counters.
`;
}

async function main() {
  const specRaw = await readFile(specPath, 'utf8');
  const spec = JSON.parse(specRaw);
  const renderedSchedule = `${renderGasSchedule(spec)}\n`;

  if (CHECK_MODE) {
    const current = await readFile(gasScheduleDocPath, 'utf8');
    if (current !== renderedSchedule) {
      throw new Error(
        `Generated docs differ. Re-run: node tools/gas-spec/render-gas-artifacts.mjs`,
      );
    }
    return;
  }

  await writeFile(gasScheduleDocPath, renderedSchedule, 'utf8');
}

await main();
