# consumer-proof-app

Downstream application proof that consumes published `@blue-quickjs/*`
artifacts and validates deterministic parity from a consumer’s point of view.

It supports both release-rehearsal paths used by the repo:

- **tarball rehearsal** — install locally packed publish-style tarballs
- **registry/Verdaccio rehearsal** — publish to a local registry and install
  from there

## Tarball rehearsal flow

1. Pack publish-style tarballs from repo root:

   ```bash
   node tools/workload-certification/pack-public-tarballs.mjs --out-dir artifacts/consumer-proof/tarballs
   ```

2. Install tarballs into this app:

   ```bash
   cd e2e/consumer-proof-app
   pnpm run install:tarballs -- --tarball-dir ../../artifacts/consumer-proof/tarballs
   ```

3. Generate the reproducibility report (node + browser + OOG boundary):

   ```bash
   pnpm run repro
   ```

   Firefox parity run:

   ```bash
   pnpm run repro -- --browser firefox
   ```

## Registry / Verdaccio rehearsal flow

From repo root:

```bash
pnpm publish-rehearsal:verdaccio -- --out-dir artifacts/consumer-proof/verdaccio
```

That flow publishes the workspace packages into a local Verdaccio registry,
installs them into this consumer app, and then runs the same downstream proof.

## Outputs

Reports are written to:

- `e2e/consumer-proof-app/reports/`

Key artifacts include:

- reproducibility report
- OOG-boundary report
- optional native diagnostic report

## Optional native diagnostic run

Native remains non-consensus. Use only as a diagnostic supplement:

```bash
pnpm run repro -- --with-native
```
