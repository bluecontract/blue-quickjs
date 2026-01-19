## 0.3.1 (2026-01-19)

### 🩹 Fixes

- **quickjs-wasm-build:** avoid -sDETERMINISTIC host clock patching ([02f922d](https://github.com/bluecontract/blue-quickjs/commit/02f922d))

## 0.3.0 (2026-01-15)

### 🚀 Features

- **quickjs-runtime:** inject currentContract globals into deterministic context ([35e77c5](https://github.com/bluecontract/blue-quickjs/commit/35e77c5))

## 0.2.4 (2026-01-08)

### 🩹 Fixes

- update vendor/quickjs submodule ([b2b361c](https://github.com/bluecontract/blue-quickjs/commit/b2b361c))

## 0.2.3 (2026-01-07)

### 🩹 Fixes

- **dv:** improve unsupported type descriptions in encoder ([2799f5a](https://github.com/bluecontract/blue-quickjs/commit/2799f5a))

## 0.2.2 (2026-01-07)

### 🚀 Features

- **quickjs:** bump vendor submodule and update canon.unwrap expectations ([13c6c8a](https://github.com/bluecontract/blue-quickjs/commit/13c6c8a))

## 0.2.1 (2026-01-07)

### 🚀 Features

- **native-harness:** document `canon.unwrap` deep flag and add coverage for shallow vs deep ([b30cead](https://github.com/bluecontract/blue-quickjs/commit/b30cead))
- **vendor:** update quickjs submodule to latest commit 82af2dd ([cc31f75](https://github.com/bluecontract/blue-quickjs/commit/cc31f75))

## 0.2.0 (2026-01-05)

### 🚀 Features

- **quickjs-wasm:** extract wasm artifact constants into new package ([f3d2595](https://github.com/bluecontract/blue-quickjs/commit/f3d2595))
- **workflow:** add manual trigger for publishing with tag input ([c19e7ca](https://github.com/bluecontract/blue-quickjs/commit/c19e7ca))

## 0.1.0 (2025-12-19)

### 🚀 Features

- Integrate QuickJS-Wasm library into Nx workspace, adding configuration files, ESLint setup, and Vitest support for testing. Update package dependencies and workspace layout for improved development experience. ([53eed5a](https://github.com/bluecontract/blue-quickjs/commit/53eed5a))
- Scaffold smoke-node and smoke-web applications with ESLint, Vitest configurations, and initial implementations. Add necessary libraries and update workspace structure for improved development workflow. ([ef8f915](https://github.com/bluecontract/blue-quickjs/commit/ef8f915))
- Add QuickJS fork as a git submodule in the vendor directory, with updated README documentation for initialization and pinning workflow. ([e241ea5](https://github.com/bluecontract/blue-quickjs/commit/e241ea5))
- Pin Emscripten toolchain to version 3.1.56, add setup script and documentation for local installation and CI caching ([0931ff7](https://github.com/bluecontract/blue-quickjs/commit/0931ff7))
- Implement native harness for QuickJS fork, enabling evaluation of JS strings with deterministic output. Includes build and test scripts, project configuration, and updates to the implementation plan documentation. ([a898105](https://github.com/bluecontract/blue-quickjs/commit/a898105))
- Complete implementation of deterministic VM init hook in QuickJS fork. Update harness to utilize new initializer, enhance tests for disabled globals, and refine documentation for clarity on global scope restrictions. ([3c97e16](https://github.com/bluecontract/blue-quickjs/commit/3c97e16))
- Enhance QuickJS harness with gas metering and OOG boundary tests. Update implementation plan to reflect completion of gas-related tasks, including per-opcode gas charges, deterministic OOG error handling, and integration of gas reporting in harness tests. Add new tests for array methods and gas limits to ensure compliance with deterministic behavior. ([be5ec2a](https://github.com/bluecontract/blue-quickjs/commit/be5ec2a))
- Complete gas golden tests for QuickJS harness. Mark T-028 as done in the implementation plan. Add comprehensive gas fixtures and a Node runner for validation. Update README with gas goldens usage instructions. ([94744cb](https://github.com/bluecontract/blue-quickjs/commit/94744cb))
- Implement QuickJS-in-Wasm build with gas metering and create build scripts. Update README with build instructions and add project configuration for Nx. Enhance test suite to validate artifact paths and outputs. ([cb696c9](https://github.com/bluecontract/blue-quickjs/commit/cb696c9))
- add GitHub workflows for publishing and releasing ([dc50fc1](https://github.com/bluecontract/blue-quickjs/commit/dc50fc1))
- **abi-manifest:** add canonical ABI manifest encoding, hashing, and strict validation ([934dbd6](https://github.com/bluecontract/blue-quickjs/commit/934dbd6))
- **abi-manifest:** publish Host.v1 manifest fixtures (HOST_V1_*) ([7b75fec](https://github.com/bluecontract/blue-quickjs/commit/7b75fec))
- **det-eval:** enforce DV-only outputs and decode hex payloads ([b47b0cd](https://github.com/bluecontract/blue-quickjs/commit/b47b0cd))
- **determinism:** add cross-env fixture harness for determinism + gas ([b32e838](https://github.com/bluecontract/blue-quickjs/commit/b32e838))
- **determinism:** complete host-call determinism tests and update implementation plan ([1643fda](https://github.com/bluecontract/blue-quickjs/commit/1643fda))
- **determinism:** finalize manifest pinning tests and update implementation plan ([3d5bacd](https://github.com/bluecontract/blue-quickjs/commit/3d5bacd))
- **dv:** introduce DV encoding and decoding functionality with comprehensive tests ([bd73b60](https://github.com/bluecontract/blue-quickjs/commit/bd73b60))
- **dv-wire-format:** finalize and document canonical DV encoding rules ([26e8512](https://github.com/bluecontract/blue-quickjs/commit/26e8512))
- **harness:** wire ABI manifest validation + sha256 helper ([0e6b521](https://github.com/bluecontract/blue-quickjs/commit/0e6b521))
- **hash-utils:** enhance sha256Hex function for ArrayBuffer compatibility ([eaa7b0d](https://github.com/bluecontract/blue-quickjs/commit/eaa7b0d))
- **hash-utils:** enhance sha256Hex function for ArrayBuffer compatibility ([b81f083](https://github.com/bluecontract/blue-quickjs/commit/b81f083))
- **host-call:** stub wasm import and add native harness coverage for host_call ([a42e970](https://github.com/bluecontract/blue-quickjs/commit/a42e970))
- **host-call:** wire HostError envelope parsing into harness + builds ([68ce860](https://github.com/bluecontract/blue-quickjs/commit/68ce860))
- **quickjs-native-harness:** add DV encode/decode CLI and TS parity test ([4c8a2d4](https://github.com/bluecontract/blue-quickjs/commit/4c8a2d4))
- **quickjs-runtime:** integrate validation for program artifacts and input envelopes ([690c8a2](https://github.com/bluecontract/blue-quickjs/commit/690c8a2))
- **quickjs-runtime:** add Host.v1 TS host_call dispatcher adapter (T-061) ([caacb53](https://github.com/bluecontract/blue-quickjs/commit/caacb53))
- **quickjs-runtime:** add wasm runtime instantiation for Node/browser and wire smoke-web (T-062) ([2b4a9bb](https://github.com/bluecontract/blue-quickjs/commit/2b4a9bb))
- **quickjs-runtime:** add evaluate() API with deterministic result model, tape, and gas trace (T-064) ([3471882](https://github.com/bluecontract/blue-quickjs/commit/3471882))
- **quickjs-runtime:** implement stable error mapping and handling in evaluate() ([4b9aeac](https://github.com/bluecontract/blue-quickjs/commit/4b9aeac))
- **quickjs-runtime:** enhance validation for program artifacts ([d6cac11](https://github.com/bluecontract/blue-quickjs/commit/d6cac11))
- **quickjs-wasm:** enhance package with deterministic artifacts and metadata ([3e6ecc6](https://github.com/bluecontract/blue-quickjs/commit/3e6ecc6))
- **quickjs-wasm:** add implicit dependency on quickjs-wasm-build ([c839af3](https://github.com/bluecontract/blue-quickjs/commit/c839af3))
- **quickjs-wasm:** establish explicit dependency on quickjs-wasm-build ([cc14fd6](https://github.com/bluecontract/blue-quickjs/commit/cc14fd6))
- **quickjs-wasm-build:** emit wasm build metadata + add TS helpers (T-050) ([89ff247](https://github.com/bluecontract/blue-quickjs/commit/89ff247))
- **quickjs-wasm-build:** enforce deterministic wasm memory/flags and record build config (T-051) ([dbe67da](https://github.com/bluecontract/blue-quickjs/commit/dbe67da))
- **quickjs-wasm-build:** export additional QuickJS WASM basenames for enhanced module integration ([9b04e06](https://github.com/bluecontract/blue-quickjs/commit/9b04e06))
- **release:** enhance release configuration and changelog settings ([081c94f](https://github.com/bluecontract/blue-quickjs/commit/081c94f))
- **runtime:** add deterministic init/eval wasm entrypoints and TS handshake (T-063) ([a3fd62e](https://github.com/bluecontract/blue-quickjs/commit/a3fd62e))
- **smoke:** share Host.v1 smoke fixtures and assert deterministic baselines ([056f636](https://github.com/bluecontract/blue-quickjs/commit/056f636))
- **smoke-node:** implement smoke runner with CLI support and fixtures ([1e4a386](https://github.com/bluecontract/blue-quickjs/commit/1e4a386))
- **smoke-web:** integrate QuickJS wasm gas fixtures in browser with Playwright tests ([3e7e664](https://github.com/bluecontract/blue-quickjs/commit/3e7e664))
- **test-harness:** add wasm/native gas equivalence suite ([ae78930](https://github.com/bluecontract/blue-quickjs/commit/ae78930))
- **test-harness:** add Host.v1 ABI manifest fixtures and wire into abi-manifest tests ([604f8f6](https://github.com/bluecontract/blue-quickjs/commit/604f8f6))
- **tests:** add assert_reject function to enhance test coverage ([5721dd8](https://github.com/bluecontract/blue-quickjs/commit/5721dd8))
- **wasm:** default gas baselines to wasm32; add optional wasm64 debug variant ([ec8bfc3](https://github.com/bluecontract/blue-quickjs/commit/ec8bfc3))
- **wasm:** complete early QuickJS-in-Wasm gas harness and document limitations ([ae67376](https://github.com/bluecontract/blue-quickjs/commit/ae67376))
- **wasm:** add release/debug build types and propagate buildType across artifacts (T-053) ([6571075](https://github.com/bluecontract/blue-quickjs/commit/6571075))

### 🩹 Fixes

- Update QuickJS submodule URL to use GitHub repository ([5c90ea6](https://github.com/bluecontract/blue-quickjs/commit/5c90ea6))
- **host:** reserve transport/envelope error codes and prevent buffer overlap ([140bd45](https://github.com/bluecontract/blue-quickjs/commit/140bd45))
- **quickjs-wasm:** update eslint and vite configurations to improve dependency handling ([06afe89](https://github.com/bluecontract/blue-quickjs/commit/06afe89))
- **release:** update ref in release workflow to use github.ref directly ([dc11594](https://github.com/bluecontract/blue-quickjs/commit/dc11594))
- **tests:** update maxEncodedBytes to use DV_LIMIT_DEFAULTS in dv.spec.ts ([f0f7cd6](https://github.com/bluecontract/blue-quickjs/commit/f0f7cd6))