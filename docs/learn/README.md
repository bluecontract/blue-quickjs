# Learn BlueQuickjs

This path is for readers who want more than the root README quickstart but less
than the full reference set.

## Recommended Path

1. [What is BlueQuickjs?](./00-what-is-bluequickjs.md)
2. [Install and run your first script](./01-install-and-run-your-first-script.md)
3. [Understand the program artifact](./02-understand-the-program-artifact.md)
4. [Build a real example](./08-build-a-real-example.md)
5. [Production embedder checklist](./09-production-embedder-checklist.md)

## Topic Deep Dives

Read these when the topic matters to your integration:

- [Module packs and imports](./03-module-packs-and-imports.md)
- [Promises, async, and microtasks](./04-promises-async-and-microtasks.md)
- [Binary mode and Host.v2](./05-binary-and-host-v2.md)
- [Gas, OOG, and max-gas policies](./06-gas-oog-and-max-gas-policies.md)
- [Verify release evidence](./07-verify-release-evidence.md)

## References

- [Core concepts](../concepts.md)
- [Architecture overview](../architecture-overview.md)
- [Glossary](../glossary.md)
- [FAQ](../faq.md)
- [Unsupported features and why](../unsupported-features-and-why.md)
- [Consensus-safe vs diagnostic-only](../consensus-safe-vs-diagnostic-only.md)

## What This Path Teaches

By the end of the recommended path you should be able to:

- explain the current consensus-safe scope,
- run deterministic scripts in wasm,
- understand how `ProgramArtifact.v2` pins engine, profile, gas, and ABI
  identity,
- use module packs instead of runtime imports,
- inspect exact gas and OOG boundaries,
- verify generated release evidence,
- embed BlueQuickjs safely in production.
