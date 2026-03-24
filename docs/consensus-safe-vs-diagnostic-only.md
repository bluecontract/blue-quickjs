# Consensus-safe vs diagnostic-only

This page is the short answer to a critical release question:

**what counts as the current consensus contract, and what is only diagnostic?**

## Consensus-safe today

The current consensus-safe executor matrix is:

| Surface | Status | Notes |
| --- | --- | --- |
| `wasm-node` | consensus-safe | canonical `wasm32` release artifact |
| `wasm-browser` | consensus-safe | canonical `wasm32` release artifact |

Release-critical parity for this matrix is exact:

- value/error parity,
- gas used parity,
- gas remaining parity,
- host-call tape parity,
- OOG boundary parity.

## Diagnostic-only today

| Surface | Status | Why it is not consensus-safe today |
| --- | --- | --- |
| native harness | diagnostic-only | useful for debugging and reconciliation, but not the current release gate |
| WebKit browser runs | diagnostic-only | informative compatibility signal, not required release matrix |
| debug Wasm builds | diagnostic-only | useful for assertions/investigation, not the canonical release engine |
| alternate Wasm variants | diagnostic-only | canonical release scope is pinned to wasm32 |

## What “diagnostic-only” does not mean

Diagnostic-only does **not** mean “ignored” or “unimportant.” It means:

- the repo may still generate reports for that surface,
- engineers may still use it to investigate mismatches,
- the release cannot market it as consensus-safe without explicit promotion.

## What would change this page?

Only an explicit policy and release decision should widen the consensus surface.
The repo should never silently drift from this page.

## Related docs

- [Release policy](./release-policy.md)
- [HEAD verification note](./head-verification-note.md)
- [Production embedder checklist](./production-embedder-checklist.md)
- [Workload certification](./workload-certification.md)
