# Ecosystem Compatibility Report

This report tracks the current certification corpus in
`apps/ecosystem-certifier/src/shared/fixtures.ts`.

## Green corpus (16 packages)

All fixtures below are expected to pass with strict node/browser parity.

| Package | Fixture id | Profile |
| --- | --- | --- |
| `chess.js` | `green-chess` | `compat-general-v1` |
| `base64-js` | `green-base64` | `compat-binary-v1` |
| `@noble/hashes` | `green-noble-sha` | `compat-binary-v1` |
| `semver` | `green-semver` | `compat-general-v1` |
| `he` | `green-he` | `compat-general-v1` |
| `path-to-regexp` | `green-path-to-regexp` | `compat-general-v1` |
| `fast-json-stable-stringify` | `green-fast-json-stable-stringify` | `compat-general-v1` |
| `json-logic-js` | `green-json-logic-js` | `compat-general-v1` |
| `crc-32` | `green-crc32` | `compat-binary-v1` |
| `tinyqueue` | `green-tinyqueue` | `compat-general-v1` |
| `fflate` | `green-fflate` | `compat-binary-v1` |
| `linkify-it` | `green-linkify-it` | `compat-general-v1` |
| `markdown-it` | `green-markdown-it` | `compat-binary-v1` |
| `escape-string-regexp` | `green-escape-string-regexp` | `compat-general-v1` |
| `fast-deep-equal` | `green-fast-deep-equal` | `compat-general-v1` |
| Seeded stress corpus | `green-stress-corpus` | `compat-general-v1` |

## Red corpus (8 scenarios)

All fixtures below are expected deterministic failures with stable failure stage.

| Scenario | Fixture id | Expected stage | Why |
| --- | --- | --- | --- |
| `diff` timer usage | `red-diff-timers` | `builder_reject` | package references `setTimeout` |
| `yaml` date usage | `red-yaml-date` | `builder_reject` | package references `Date` |
| `graphlib` proxy usage | `red-graphlib-proxy` | `builder_reject` | package references `Proxy` |
| Dynamic import | `red-dynamic-import` | `builder_reject` | `import()` disabled |
| Proxy API | `red-proxy` | `builder_reject` | `Proxy` disabled |
| Randomness API | `red-math-random` | `builder_reject` | `Math.random()` disabled |
| `lodash-es` runtime codegen path | `red-lodash-function-constructor` | `artifact_validation` | runtime reaches `Function` constructor path |
| Function constructor explicit | `red-function-constructor` | `artifact_validation` | deterministic runtime rejects dynamic codegen |

## Flagship workload status

- Fixture id: `flagship-knowledge-pack`
- Uses mixed deterministic package set (markdown/linkification/rules/semver/binary
  decode/hash/queue ordering).
- Runs under `compat-binary-v1` with Host.v2 and emits deterministic tape
  evidence.

## Machine-readable evidence

Generate and archive:

```bash
node apps/ecosystem-certifier/scripts/archive-workload-certification-report.mjs --out-dir artifacts/workload-certification
```

Use `compatibilityMatrix` and `records` in the generated JSON as canonical
source-of-truth for certification decisions.
