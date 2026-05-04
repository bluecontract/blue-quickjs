# QuickJS source patches

This repo stores Blue QuickJS changes as an ordered patch series under
`vendor/quickjs-patches/series`.

The working tree under `vendor/quickjs` is generated from:
- upstream repo `https://github.com/bellard/quickjs.git`
- base commit `e5fd3918c1c4a2ee39016e71b66a9eeda85ce716`
- patch manifest `vendor/quickjs-patches/manifest.json`

## Prepare source
- Run `bash tools/scripts/prepare-quickjs-source.sh` to recreate `vendor/quickjs`.
- `pnpm setup` runs the same preparation step automatically.
- `vendor/quickjs` is generated workspace state and should not be committed.

## Updating patches
- Make QuickJS changes in a dedicated fork or working branch outside this repo.
- Export the commit series into `vendor/quickjs-patches/series`.
- Update `vendor/quickjs-patches/manifest.json` if the upstream base or patch count changes.
- Re-run `bash tools/scripts/prepare-quickjs-source.sh` to regenerate `vendor/quickjs`.
