# HEAD verification note (release-candidate productization pass)

Date: 2026-03-18  
Baseline commit reviewed: `1b3b8f87dde83fb697cd786e50c067ab272fe5fd`

## 1) What was already implemented at HEAD

- Strict consensus release policy centered on `wasm-node` vs `wasm-browser`
  using pinned canonical `wasm32` artifacts.
- Program artifact/model docs and code paths for:
  - `ProgramArtifact.v2`
  - `ModulePack.v1`
  - execution profiles (`baseline-v1`, `compat-general-v1`, `compat-binary-v1`)
  - DV2/Host.v2 binary boundary support.
- Release-readiness report evidence with a latest consensus run reporting:
  - fixture count `38`
  - mismatch count `0`
- Native harness parity tooling present and explicitly diagnostic by default.
- Runtime release-mode pin checks for `engineBuildHash`, `gasVersion`, and
  `executionProfile`.

## 2) Stale drift found during verification

- `docs/implementation-plan.md` still contained older milestone wording that
  read as current state:
  - early sections implying Promise jobs / `queueMicrotask` are globally
    disabled;
  - early sections implying typed arrays are globally disabled;
  - early sections implying JSON builtins/sort are disabled globally rather than
    profile-gated or metered.
- Root-level product messaging lacked a concise “consensus-safe today” section.
- Release policy lacked a matching concise “consensus-safe today” summary block.
- `docs/examples.md` was too sparse for first-time reviewers (link-only without
  usage interpretation).

## 3) What this pass fixed in docs (phase 1 reconciliation)

- Reconciled `docs/implementation-plan.md` to mark early P1/P2 snapshots as
  historical milestones and align their interpretation with P17–P19 outcomes.
- Added explicit consensus-safe scope and profile-at-a-glance sections to
  `README.md`.
- Added explicit consensus-safe scope section to `docs/release-policy.md`.
- Expanded `docs/examples.md` into a practical guide that points readers to the
  corpus/evidence flow and clarifies consensus-safe vs diagnostic-only evidence.

## 4) Outcome

After this reconciliation, the docs no longer present contradictory
“current-state” claims for Promise jobs, queueMicrotask, typed arrays, and
binary profile behavior. The product story now explicitly distinguishes:

- strict baseline behavior,
- compatibility profile behavior,
- consensus-safe executor scope,
- diagnostic-only native scope.
