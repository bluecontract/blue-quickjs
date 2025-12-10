# BlueQuickjs

Deterministic QuickJS-in-Wasm evaluator monorepo (Nx + pnpm), tracking a hardened QuickJS fork and SDK/tooling to run it.

## QuickJS fork
- Submodule at `vendor/quickjs` (origin `git@blue.github.com:mjwebblue/quickjs.git`).
- Fresh checkout: `git submodule update --init --recursive`.
- Update the pin after landing changes in the fork: `cd vendor/quickjs && git fetch origin && git checkout <new-ref>` then `cd .. && git add vendor/quickjs && git commit -m "chore: bump quickjs submodule"`.
- Do QuickJS edits in the fork repository and only commit the pinned SHA here.

## Workspace basics
- Install deps: `pnpm install`.
- Visualize projects: `pnpm nx graph`.
- Run tests across projects: `pnpm nx run-many -t test`.
- Apply lint fixes: `pnpm lint --fix`.
