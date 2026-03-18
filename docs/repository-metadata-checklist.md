# Repository metadata checklist (GitHub settings)

This checklist tracks the release-story polish that lives in GitHub repository
settings rather than source files.

## 1) Description

Set repository description to a product-facing summary, for example:

> Deterministic QuickJS-in-Wasm engine for consensus-critical JavaScript
> execution with exact gas/OOG parity and manifest-locked host ABI.

## 2) Topics

Recommended topics:

- `quickjs`
- `webassembly`
- `deterministic-execution`
- `consensus`
- `gas-metering`
- `reproducibility`
- `runtime`
- `javascript`

## 3) Website pointer

Set repository website to the release landing documentation entry:

- `https://github.com/bluecontract/blue-quickjs/blob/main/README.md`

If a dedicated release portal is published later, replace this URL with that
stable endpoint.

## 4) Required verification

After applying metadata:

1. Confirm repo home page shows updated description/topics/website.
2. Confirm README opening matches the same product framing.
3. Confirm release notes and readiness docs reference the same consensus-safe
   scope language.
