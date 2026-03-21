# Playground recipes

These recipes map common learning tasks to concrete playground actions.

## 1. Run your first script

1. Open the playground.
2. Leave the default **Gallery** selection on **Basic deterministic script**.
3. Click **Run current selection**.
4. Open the **Result** tab and inspect:
   - result hash
   - gas used
   - gas remaining

What this teaches:

- how the browser runtime reports deterministic success,
- what an evidence-backed happy-path run looks like.

## 2. Run a Promise example

1. Choose **Promises / async / microtasks** from the gallery.
2. Confirm the profile is `compat-general-v1`.
3. Click **Run current selection**.
4. Open the **Determinism evidence** tab and confirm the browser run matches the
   certified snapshot.

What this teaches:

- Promise jobs are profile-gated,
- `compat-general-v1` is the right profile for deterministic async support.

## 3. Run a library/module-pack example

1. Choose **Standard ESM module-pack** or **Real npm library reuse**.
2. Click **Run current selection**.
3. Open the **Metadata** tab and inspect:
   - `sourceKind`
   - module graph hash
   - execution profile

What this teaches:

- imports are resolved into deterministic module packs ahead of execution,
- the runtime is executing a pinned artifact, not fetching modules live.

## 4. Inspect a red deterministic failure

1. Scroll to **Red fixtures** in the left rail.
2. Choose a fixture such as **dynamic import must be rejected at build stage**.
3. Open the **Determinism evidence** tab.
4. Read the failure stage and diagnostics.

What this teaches:

- unsupported behavior is surfaced explicitly,
- deterministic failures are part of the product, not hidden edge cases.

## 5. Inspect a max-gas boundary

1. Choose **Max-gas policy / OOG boundary**.
2. Click **Find OOG boundary**.
3. Open the **Determinism evidence** tab.
4. Inspect:
   - `firstSuccessGas`
   - `lastFailureGas`
   - failure code/tag

What this teaches:

- exact OOG boundaries are visible and reproducible,
- gas policy is part of deterministic release evidence.

## 6. Inspect a Host.v2 bytes roundtrip

1. Choose **Binary / typed arrays / Host.v2 DV2**.
2. Click **Run current selection**.
3. Open the **Host + tape** tab.
4. Inspect the host payload previews and tape metadata.

What this teaches:

- `compat-binary-v1` and `Host.v2` are how byte-oriented workloads cross the
  host boundary,
- the playground exposes both high-level result data and host interaction
  evidence.
