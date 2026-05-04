# Operator threat model (wasm-consensus scope)

This threat model is operator-facing and focused on production usage of the
wasm-consensus executor path.

## In-scope guarantees

For the same `(P, I, G)` and deterministic host responses:

- deterministic result/error parity,
- deterministic gas used/remaining parity,
- deterministic host-call tape parity,
- deterministic exact OOG boundary parity

across consensus executors (`wasm-node` + required browser engines).

## Out-of-scope guarantees

- native harness parity as a consensus claim (native is diagnostic-only unless
  explicitly promoted),
- behavior of disabled nondeterministic APIs (time/random/timers/fs/network),
- security of host systems outside manifest-locked Host ABI boundaries.

## Main threat categories

1. **Artifact tampering**
   - altered evidence files, checksums, or manifests.
   - Mitigation: checksum + detached signature verification.

2. **Pin drift**
   - unexpected `engineBuildHash` / `gasVersion` changes.
   - Mitigation: explicit pin review and release go/no-go recording.

3. **Host capability widening**
   - accidental ABI or runtime surface widening beyond profile policy.
   - Mitigation: manifest lock, profile checks, deterministic negative fixtures.

4. **Cross-environment parity regressions**
   - browser/runtime drift introducing mismatch.
   - Mitigation: strict parity matrix and OOG certification in CI/release.

## Mandatory production pins

- `engineBuildHash`
- `gasVersion`
- ABI manifest hash
- execution profile

## Native status reminder

Native executor output is diagnostic-only and must not be used as consensus
acceptance criteria unless release policy explicitly promotes native for that
release line.
