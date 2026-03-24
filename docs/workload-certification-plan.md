# Workload Certification Plan (RC ecosystem phase)

This plan defines the certification work for proving that `blue-quickjs` is a
practical deterministic JavaScript platform for downstream workloads and npm
ecosystem reuse.

The goal of this phase is **evidence**, not broadening VM semantics.

## Scope and non-goals

### In scope

1. In-repo workload lab app for mixed real-world deterministic workloads.
2. Downstream consumer app that installs published-style package tarballs and
   runs outside workspace shortcuts.
3. Broad compatibility matrix with deterministic pass/fail boundaries.
4. Strict wasm-node vs wasm-browser parity evidence for:
   - result/error,
   - gas used/remaining,
   - host tape,
   - exact OOG boundary.
5. Machine-readable reproducibility artifacts and certification reports.

### Out of scope

- Opportunistic VM feature expansion to make individual libraries pass.
- Re-defining consensus executor policy (native remains diagnostic-only).

## Phase order

### Phase 1 — foundation and planning lock

- Verify branch is positioned after the RC line.
- Create this certification plan first.
- Finalize flagship workload architecture and candidate corpora.
- Scaffold workload-lab and downstream app surfaces.

### Phase 2 — first working certification path

- Implement downstream tarball install/build/run flow.
- Implement workload-lab node/browser runners.
- Land initial compatibility fixtures (green + red).
- Emit first parity report JSON.

### Phase 3 — full workload + matrix hardening

- Finish flagship demanding app.
- Expand compatibility matrix to target counts.
- Add OOG boundary harness, soak runs, and deterministic property/stress
  corpora.

### Phase 4 — reporting and release integration

- Final certification reports.
- CI/release artifact generation hooks.
- README/docs index updates.

## Deliverables

1. **Workload lab app** (`apps/ecosystem-certifier`)
   - source + deterministic fixtures
   - node and browser runners
   - parity/OOG/soak/property scripts
   - report archiver (JSON + markdown + checksums + signature digest)

2. **Downstream consumer app** (`e2e/consumer-proof-app`)
   - install from tarballs only
   - artifact build + node/browser run
   - parity + OOG comparison
   - reproducibility report

3. **Ecosystem compatibility report**
   - `docs/ecosystem-compatibility-report.md`
   - green/red matrix, profile requirements, deterministic failure reasons,
     evidence references

4. **Workload certification report**
   - `docs/workload-certification.md`
   - flagship architecture, library set, parity/OOG evidence, known limits

## Flagship workload

The flagship workload is a deterministic “knowledge/compliance pack processor”.
It processes fixed synthetic corpora containing:

- markdown documents,
- YAML metadata,
- semver rules,
- JSON rule sets,
- binary attachments (base64/compressed bytes),
- link/dependency graphs,
- emitted findings/traces.

Pipeline stages:

1. host document reads (manifest-locked),
2. metadata parse/normalize,
3. markdown token/link extraction,
4. semver rule evaluation,
5. findings synthesis,
6. binary decode/decompress/hash,
7. graph build + deterministic traversal,
8. stable sort + canonical summary output,
9. deterministic host emit trace.

## Compatibility matrix goals

### Positive corpus target

At least **12–15 green packages**, spanning multiple categories
(text/metadata, utilities, rules/parsing, algorithms/data structures, binary).

### Negative corpus target

At least **5 deterministic red scenarios** proving crisp unsupported boundaries,
including dynamic codegen, Proxy dependence, randomness/time APIs, and
environment-dependent imports.

Each red fixture records deterministic failure stage:

- builder rejection,
- artifact validation/pin failure,
- runtime deterministic error.

## Determinism evidence requirements

For major workloads and compatibility fixtures:

- exact result/error parity between wasm-node and wasm-browser,
- exact gas used and gas remaining parity,
- exact host tape hash and tape length (where host calls occur),
- exact first-success/last-failure OOG boundary parity.

Repeatability subset:

- 50–100 reruns with identical result hash, gas, tape, and failure behavior.

Builder determinism evidence:

- identical graph/artifact hashes across path variation and OS matrix builds.

## Evidence artifacts

Certification scripts must emit machine-readable artifacts including:

- parity report JSON,
- compatibility matrix JSON,
- OOG boundary JSON,
- human summary markdown,
- checksums (`.sha256`),
- signature digest field (sha256 over canonical report payload).

## Policy guardrails

- Deterministic contract is never loosened just to pass a package.
- Unsupported behavior is documented as deterministic failure, not hidden.
- Native executor output is diagnostic-only unless release policy changes.
