# @blue-quickjs/deterministic-bundler

Deterministic single-source bundling for `blue-quickjs` program artifacts.

- Flattens static module graphs into one script string.
- Produces stable SHA-256 content hashes.
- Runs a deterministic compatibility scan for disabled runtime surfaces.

Build/test:

- `pnpm nx build deterministic-bundler`
- `pnpm nx test deterministic-bundler`
