# consumer-proof-app

Downstream application proof that consumes `@blue-quickjs/*` from packed
tarballs and validates deterministic parity.

## Flow

1. Pack publish-style tarballs from repo root:

   ```bash
   node tools/workload-certification/pack-public-tarballs.mjs
   ```

2. Install tarballs into this app:

   ```bash
   cd e2e/consumer-proof-app
   pnpm run install:tarballs -- --tarball-dir ../../artifacts/consumer-proof/tarballs
   ```

3. Generate reproducibility report (node + browser + OOG boundary):

   ```bash
   pnpm run repro
   ```

Reports are written to `e2e/consumer-proof-app/reports/`.

Optional native diagnostic run (non-consensus):

```bash
pnpm run repro -- --with-native
```
