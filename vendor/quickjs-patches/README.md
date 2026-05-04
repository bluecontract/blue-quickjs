# QuickJS Patch Series

This directory contains the exported patch series for the Blue QuickJS fork.

Source:
- Fork repo: `vendor/quickjs`
- Upstream repo: `https://github.com/bellard/quickjs.git`
- Upstream base commit: `e5fd3918c1c4a2ee39016e71b66a9eeda85ce716`
- Vendored upstream base archive:
  `vendor/quickjs-patches/upstream/quickjs-base-e5fd3918c1c4a2ee39016e71b66a9eeda85ce716.tar.gz`
- Vendored archive SHA-256:
  `a2ff2baaa328275baa490596f4751b85f1e39419b9f7f44c3e83e9fac9dc9217`
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

Archive generation command:

```sh
git -C vendor/.quickjs-cache/upstream.git archive \
  --format=tar \
  --prefix=quickjs-base/ \
  e5fd3918c1c4a2ee39016e71b66a9eeda85ce716 |
  gzip -n > vendor/quickjs-patches/upstream/quickjs-base-e5fd3918c1c4a2ee39016e71b66a9eeda85ce716.tar.gz
sha256sum vendor/quickjs-patches/upstream/quickjs-base-e5fd3918c1c4a2ee39016e71b66a9eeda85ce716.tar.gz \
  > vendor/quickjs-patches/upstream/quickjs-base-e5fd3918c1c4a2ee39016e71b66a9eeda85ce716.tar.gz.sha256
```
