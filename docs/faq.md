# FAQ

## Is BlueQuickjs a general-purpose JavaScript runtime?

No. It is a deterministic execution product for consensus-critical workloads.
The repo intentionally excludes or gates many capabilities that ordinary JS
runtimes expose freely.

## What is the consensus-safe executor matrix?

Today it is:

- `wasm-node`
- `wasm-browser`

using the canonical `wasm32` release engine.

## Is native consensus-safe?

Not today. Native remains diagnostic-only unless release policy explicitly
promotes it later.

## Why are imports build-time deterministic instead of runtime dynamic?

Because runtime fetch/import behavior would widen the deterministic surface.
BlueQuickjs resolves imports ahead of time and executes a pinned
`ModulePack.v1`.

## Why are there multiple execution profiles?

To keep the minimal consensus baseline narrow while still supporting specific
compatibility surfaces in explicitly versioned contracts.

## When can I use Promises?

Only under compatibility profiles that enable Promise job draining, such as
`compat-general-v1` and `compat-binary-v1`.

## When can I use typed arrays or bytes?

Only under `compat-binary-v1`, with the corresponding DV2 / `Host.v2`
boundaries.

## Why do `engineBuildHash` and `gasVersion` matter?

They are the pins that keep artifacts tied to the exact engine bytes and gas
schedule they were certified against.

## What should I trust: docs or generated evidence?

Generated evidence. The docs should explain the product, but release-critical
truth comes from the consensus, workload, consumer-proof, and release-evidence
artifacts.
