# QuickJS Patch Series

This directory contains the exported patch series for the Blue QuickJS fork.

Source:
- Fork repo: `vendor/quickjs`
- Upstream repo: `https://github.com/bellard/quickjs.git`
- Upstream base commit: `e5fd3918c1c4a2ee39016e71b66a9eeda85ce716`
- Exported fork head: `8b3253bddf6a5a792dd098b1a8a154f534b88586`

Series layout:
- `series/*.patch` preserves the original commit order from the fork.
- Patch `0001` applies first.
- Patch `0051` applies last.

Generation command:

```sh
git -C vendor/quickjs format-patch \
  --output-directory ../quickjs-patches/series \
  e5fd3918c1c4a2ee39016e71b66a9eeda85ce716..8b3253bddf6a5a792dd098b1a8a154f534b88586
```
