# 05 — Binary mode and Host.v2

Binary-heavy deterministic workloads use:

- `compat-binary-v1`
- DV2 byte encoding
- `Host.v2`

This keeps byte-oriented boundaries explicit instead of silently widening DV1 or
the baseline profile.

## Prerequisites

- Playwright Chromium installed for browser-backed certification commands
- pinned Emscripten environment loaded:

  ```bash
  source tools/emsdk/emsdk_env.sh
  ```

## Commands

Generate the workload certification report and inspect the binary-oriented
fixtures:

```bash
pnpm exec playwright install --with-deps chromium
node apps/ecosystem-certifier/scripts/archive-workload-certification-report.mjs \
  --out-dir artifacts/workload-certification \
  --browser chromium
rg "compat-binary-v1|green-base64|green-noble-sha|flagship-knowledge-pack" \
  artifacts/workload-certification -n
```

## Expected output

You should see report matches for fixtures that rely on binary support, such as:

- `green-base64`
- `green-noble-sha`
- `flagship-knowledge-pack`
- `compat-binary-v1`

Those report entries prove that the binary path is not just a docs claim — it
is exercised through generated workload evidence.

## What you learned

- Binary support is not part of the baseline; it is a versioned compatibility
  contract.
- `Host.v2` + DV2 are the deterministic boundary for byte-oriented workloads.
- The best proof that this works is generated workload evidence, not prose.

## Continue

Next: [06 — Gas, OOG, and max-gas policies](./06-gas-oog-and-max-gas-policies.md)

## Troubleshooting

- If Chromium is missing, rerun the Playwright install command.
- If the certification script fails, run `pnpm nx test ecosystem-certifier`
  first to confirm the local certifier environment is healthy.
- For the normative value-model rules, read [Value model v2 (DV2)](../value-model-v2.md).
