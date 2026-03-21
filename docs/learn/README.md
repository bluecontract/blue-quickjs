# Learn BlueQuickjs

This is the recommended newcomer path through the repository. Follow these
pages in order if you want to understand what BlueQuickjs is, run something
real, and then convince yourself that the release evidence is trustworthy.

## Suggested order

1. [00 — What is BlueQuickjs?](./00-what-is-bluequickjs.md)
2. [01 — Install and run your first script](./01-install-and-run-your-first-script.md)
3. [02 — Understand the program artifact](./02-understand-the-program-artifact.md)
4. [03 — Module packs and imports](./03-module-packs-and-imports.md)
5. [04 — Promises, async, and microtasks](./04-promises-async-and-microtasks.md)
6. [05 — Binary mode and Host.v2](./05-binary-and-host-v2.md)
7. [06 — Gas, OOG, and max-gas policies](./06-gas-oog-and-max-gas-policies.md)
8. [07 — Verify release evidence](./07-verify-release-evidence.md)
9. [08 — Build a real example](./08-build-a-real-example.md)
10. [09 — Production embedder checklist](./09-production-embedder-checklist.md)

## Supporting references

- [Architecture overview](../architecture-overview.md)
- [Glossary](../glossary.md)
- [FAQ](../faq.md)
- [Unsupported features and why](../unsupported-features-and-why.md)
- [Consensus-safe vs diagnostic-only](../consensus-safe-vs-diagnostic-only.md)

## What this path teaches

By the end of the sequence you should be able to:

- explain the current consensus-safe scope,
- run deterministic scripts in wasm,
- understand how `ProgramArtifact.v2` pins engine/profile/gas/ABI identity,
- use module packs instead of runtime imports,
- understand when Promise jobs and binary APIs are allowed,
- inspect exact gas and OOG boundaries,
- verify the generated release evidence bundle,
- embed BlueQuickjs safely in production.
