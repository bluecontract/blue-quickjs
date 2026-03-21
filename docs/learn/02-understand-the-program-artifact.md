# 02 — Understand the program artifact

`ProgramArtifact.v2` is the release-facing execution contract. It makes runtime
scope explicit instead of relying on an unstructured code string.

## Why it matters

A release-mode artifact can pin:

- `sourceKind`
- `executionProfile`
- `abiManifestHash`
- `engineBuildHash`
- `gasVersion`

Those pins are what let runtimes reject incompatible or stale execution
surfaces before consensus work begins.

## Prerequisites

- Complete [01 — Install and run your first script](./01-install-and-run-your-first-script.md)
- `tmp/learn-first-script/program.json` exists

## Commands

Inspect the artifact you just built:

```bash
node tools/blue-quickjs-cli/dist/cli.js inspect \
  --artifact tmp/learn-first-script/program.json
```

## Expected output

You should see a JSON summary with fields similar to:

- `version`
- `sourceKind`
- `executionProfile`
- `abiId`
- `abiVersion`
- `abiManifestHash`
- `engineBuildHash` (possibly `null` for a local dev artifact)
- `gasVersion` (possibly `null` for a local dev artifact)
- `graphHash`
- `moduleSpecifiers`

Builder-produced release artifacts should carry explicit
`engineBuildHash` and `gasVersion`. Local development artifacts can omit them,
but they should not be treated as release evidence.

## What you learned

- `ProgramArtifact.v2` is the object that binds source, profile, ABI identity,
  engine identity, and gas schedule identity together.
- `sourceKind` distinguishes `script` from `module-pack`.
- `executionProfile` is not cosmetic; it is part of the deterministic contract.
- Missing pins are acceptable for local iteration, but not for release-mode
  reproducibility claims.

## Continue

Next: [03 — Module packs and imports](./03-module-packs-and-imports.md)

## Troubleshooting

- If the artifact cannot be inspected, rebuild it with the previous page’s
  commands.
- For a schema-level reference, read [ProgramArtifact.v2](../program-artifact-v2.md).
- For profile meanings, read [Execution profiles](../execution-profiles.md).
