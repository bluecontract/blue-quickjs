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
