#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"
PROJECT_ROOT="${REPO_ROOT}/libs/quickjs-wasm-build"

bash "${SCRIPT_DIR}/build-wasm.sh"

(
  cd "${PROJECT_ROOT}"
  pnpm exec tsc --build tsconfig.lib.json
)
