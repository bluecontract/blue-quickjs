# QuickJS submodule

This repo pins the QuickJS fork as a git submodule at `vendor/quickjs` with origin `git@blue.github.com:mjwebblue/quickjs.git`.

## Clone / init
- From a fresh clone run: `git submodule update --init --recursive` to populate `vendor/quickjs`.

## Updating the pinned commit
- Do QuickJS development in the fork repo, not inside the submodule.
- After merging changes to the fork, update the pin here:
  1. `cd vendor/quickjs`
  2. `git fetch origin && git checkout <new-ref>`
  3. `cd .. && git add vendor/quickjs && git commit -m "chore: bump quickjs submodule"`
- Use `git submodule status` to confirm the pinned SHA.

## Remotes and branches
- Configure the upstream remote to track Bellard’s repo (for rebases/cherry-picks):  
  `cd vendor/quickjs && git remote add upstream git@github.com:bellard/quickjs.git`
- Do not push directly to the fork’s `main/master`. Use feature branches per track (e.g., `deterministic-init`, `gas-metering`, `host-abi`) and merge via PRs into the fork’s protected default branch, tagging/pinning releases you consume here.
- When updating the submodule pin, always reference a merged/annotated commit (or tag) on the fork’s default branch to keep pins reproducible.
