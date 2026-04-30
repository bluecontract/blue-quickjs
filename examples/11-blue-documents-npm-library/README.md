# Using Npm Packages In Blue Documents

This example shows the user flow for using an npm package from a Blue document:

1. Pick and pin an npm package.
2. Prepare a `BlueQuickjs/JavaScript Library Artifact` with the BlueQuickjs CLI.
3. Use that artifact through an import lock in a user document.
4. Process the user document into a deterministic `ProgramArtifact.v2`.

The concrete package used here is `chess.js@1.0.0`.

## Prerequisites

Run commands from the `blue-quickjs` repository root.

You need Node.js and npm available. The first artifact preparation step uses the
npm registry because it fetches the selected package tarball.

Build the local CLI before running the example:

```sh
pnpm install
pnpm nx build blue-quickjs-cli
```

The commands below invoke the built CLI package through pnpm and `node`.

## 1. Pick And Pin A Package

Pick an exact package version. Do not use a semver range in the Blue source
document.

For this example:

```sh
npm view chess.js@1.0.0 name version dist.integrity dist.tarball --json
```

The important value is `dist.integrity`:

```json
{
  "name": "chess.js",
  "version": "1.0.0",
  "dist.integrity": "sha512-zHaSRub6xkUXxvX9lqgovwRiBvbOmVCTh47rZ0I/HVyCiNc0T5bVLwzshL5X6JtrP+rN/CTmIxdpFr943eP97Q==",
  "dist.tarball": "https://registry.npmjs.org/chess.js/-/chess.js-1.0.0.tgz"
}
```

Use that integrity string when preparing the npm library artifact.

## 2. Prepare The Library Artifact With The CLI

Use the BlueQuickjs CLI. It runs the npm import flow, including `npm pack`, and
writes a `BlueQuickjs/JavaScript Library Artifact`:

```sh
pnpm --filter @blue-quickjs/blue-quickjs-cli exec node dist/cli.js import-npm chess.js@1.0.0 \
  --profile compat-general-v1 \
  --integrity "sha512-zHaSRub6xkUXxvX9lqgovwRiBvbOmVCTh47rZ0I/HVyCiNc0T5bVLwzshL5X6JtrP+rN/CTmIxdpFr943eP97Q==" \
  --entry auto \
  --out "$PWD/examples/11-blue-documents-npm-library/artifacts/chess-library-artifact.json"
```

`pnpm --filter ... exec` runs the command from the CLI package directory. Use
`$PWD/...` for `--out` when you want the artifact written under the repository
root. A relative path such as `--out test.json` writes to
`tools/blue-quickjs-cli/test.json`.

That command is equivalent to creating a `BlueQuickjs/Npm Library Source`
document and passing it to `importNpmLibrary(...)`. It fetches the exact package
version, verifies the tarball integrity when provided, resolves the entry, and
builds a deterministic `ModulePack.v1`.

This command writes:

```text
examples/11-blue-documents-npm-library/artifacts/chess-library-artifact.json
```

That file is a `BlueQuickjs/JavaScript Library Artifact`. It contains a pinned
`ModulePack.v1`, package provenance, source integrity, dependency integrity,
and module-pack graph hash.

## 3. Create A User Document With An Import Lock

Run:

```sh
pnpm --filter @blue-quickjs/blue-quickjs-cli exec node dist/cli.js create-step-document \
  --name "Chess legality check" \
  --entry "$PWD/examples/11-blue-documents-npm-library/entry/chess-legality-check.js" \
  --specifier chess.js \
  --library-document-id npm:chess.js@1.0.0 \
  --library "$PWD/examples/11-blue-documents-npm-library/artifacts/chess-library-artifact.json" \
  --profile compat-general-v1 \
  --abi-id Host.v1 \
  --abi-version 1 \
  --out "$PWD/examples/11-blue-documents-npm-library/artifacts/user-document.yaml"
```

The CLI reads the entry file and generated library artifact, then creates an
import lock with:

```js
import { createImportLock } from '@blue-quickjs/blue-documents';
```

It writes:

```text
examples/11-blue-documents-npm-library/artifacts/user-document.yaml
```

The generated YAML user document contains a `BlueQuickjs/JavaScript Environment
Contract` with an import lock for `chess.js`. The lock records the exact package
identity, source integrity, builder version, dependency integrity, and graph
hash. If the linked artifact changes, processing fails instead of silently using
different code.

The document also contains a `BlueQuickjs/JavaScript Step` that imports the npm
library by the locked specifier:

`examples/11-blue-documents-npm-library/entry/chess-legality-check.js`:

```js
import { Chess } from 'chess.js';

const chess = new Chess();
const legalMoves = chess.moves({ verbose: true });

export default legalMoves.some(
  (move) => move.from === 'e2' && move.to === 'e6',
);
```

## 4. Process The User Document

Run:

```sh
node examples/11-blue-documents-npm-library/scripts/02-process-document.mjs
```

The script calls:

```js
import { buildStepArtifact } from '@blue-quickjs/blue-documents';
```

It resolves the import lock against `artifacts/chess-library-artifact.json`,
verifies the lock, materializes the library module pack as a package, and writes:

```text
examples/11-blue-documents-npm-library/artifacts/user-program-artifact.json
```

The output is a deterministic `ProgramArtifact.v2` with `sourceKind:
"module-pack"`. That is the artifact a BlueQuickjs runtime can execute.
The script also prints the document JavaScript entry so you can see exactly
which code was processed.

## 5. Execute The Program Artifact

Run the processed artifact with the BlueQuickjs CLI:

```sh
pnpm --filter @blue-quickjs/blue-quickjs-cli exec node dist/cli.js run \
  --artifact "$PWD/examples/11-blue-documents-npm-library/artifacts/user-program-artifact.json"
```

The command evaluates the document entry export in BlueQuickjs. For this
example, `value` is `false` because `e2` to `e6` is not a legal opening move:

```json
{
  "ok": true,
  "value": false
}
```

## Run The Full Flow

```sh
pnpm install
pnpm nx build blue-quickjs-cli
pnpm --filter @blue-quickjs/blue-quickjs-cli exec node dist/cli.js import-npm chess.js@1.0.0 \
  --profile compat-general-v1 \
  --integrity "sha512-zHaSRub6xkUXxvX9lqgovwRiBvbOmVCTh47rZ0I/HVyCiNc0T5bVLwzshL5X6JtrP+rN/CTmIxdpFr943eP97Q==" \
  --entry auto \
  --out "$PWD/examples/11-blue-documents-npm-library/artifacts/chess-library-artifact.json"
pnpm --filter @blue-quickjs/blue-quickjs-cli exec node dist/cli.js create-step-document \
  --name "Chess legality check" \
  --entry "$PWD/examples/11-blue-documents-npm-library/entry/chess-legality-check.js" \
  --specifier chess.js \
  --library-document-id npm:chess.js@1.0.0 \
  --library "$PWD/examples/11-blue-documents-npm-library/artifacts/chess-library-artifact.json" \
  --profile compat-general-v1 \
  --abi-id Host.v1 \
  --abi-version 1 \
  --out "$PWD/examples/11-blue-documents-npm-library/artifacts/user-document.yaml"
node examples/11-blue-documents-npm-library/scripts/02-process-document.mjs
pnpm --filter @blue-quickjs/blue-quickjs-cli exec node dist/cli.js run \
  --artifact "$PWD/examples/11-blue-documents-npm-library/artifacts/user-program-artifact.json"
```

Generated files are written under:

```text
examples/11-blue-documents-npm-library/artifacts/
```

That directory is ignored by git.

## Important Runtime Detail

Npm package fetching happens during artifact preparation, not while the final
Blue document runs. The runtime executes the deterministic module pack already
stored in the generated library artifact.

## Optional: Inspect The Tarball Manually

You do not need this step for normal usage. The CLI already runs `npm pack`
internally. Manual packing is useful only when you want to inspect/debug exactly
what npm will provide, or when `entry: auto` resolves differently than expected.

```sh
mkdir -p /tmp/bluequickjs-npm
npm pack chess.js@1.0.0 \
  --json \
  --pack-destination /tmp/bluequickjs-npm \
  --registry https://registry.npmjs.org
```

Inspect the tarball contents:

```sh
tar -tzf /tmp/bluequickjs-npm/chess.js-1.0.0.tgz | head -40
```
