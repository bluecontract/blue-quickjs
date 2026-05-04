# 04 — Promises, async, and microtasks

Promise jobs are intentionally **not** part of the minimal baseline. They are
enabled only in compatibility profiles that explicitly opt into deterministic
job draining.

Today that means:

- `baseline-v1` — no Promise jobs / no `queueMicrotask`
- `compat-general-v1` — deterministic Promise jobs and `queueMicrotask`
- `compat-binary-v1` — same as `compat-general-v1`, plus binary support

## Prerequisites

- Complete [01 — Install and run your first script](./01-install-and-run-your-first-script.md)
- CLI built with `pnpm nx build blue-quickjs-cli`

## Commands

Create and run a Promise-based module under `compat-general-v1`:

```bash
mkdir -p tmp/learn-promises
printf 'export default (() => Promise.resolve(40).then((value) => value + 2))();\n' > tmp/learn-promises/entry.js
node tools/blue-quickjs-cli/dist/cli.js build \
  --entry tmp/learn-promises/entry.js \
  --profile compat-general-v1 \
  --out tmp/learn-promises/program.json
node tools/blue-quickjs-cli/dist/cli.js run \
  --artifact tmp/learn-promises/program.json \
  --gas-limit 1000000
```

## Expected output

The artifact build should succeed and the run output should look like:

```json
{
  "ok": true,
  "value": 42,
  "gasUsed": "...",
  "gasRemaining": "...",
  "tapeLength": 0
}
```

If you rebuild the same file under `baseline-v1`, the Promise path should be
rejected or fail deterministically because Promise jobs are not part of that
profile’s contract.

## What you learned

- Promise support in BlueQuickjs is **profile-gated**, not ambient.
- Deterministic job draining is part of the compatibility contract for
  `compat-general-v1` and `compat-binary-v1`.
- The right question is not “does BlueQuickjs support async?” but
  “does this artifact’s profile allow deterministic Promise jobs?”

## Continue

Next: [05 — Binary mode and Host.v2](./05-binary-and-host-v2.md)

## Troubleshooting

- If the builder reports compatibility issues, make sure the file uses only
  Promise/microtask behavior and not timers or dynamic imports.
- For the normative profile definitions, read [Execution profiles](../execution-profiles.md).
- For baseline restrictions, read [Determinism profile](../determinism-profile.md).
