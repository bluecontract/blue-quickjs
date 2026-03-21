#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"

cd "${REPO_ROOT}"

if [ ! -f "tools/emsdk/emsdk_env.sh" ]; then
  echo "Missing tools/emsdk/emsdk_env.sh"
  echo "Run: bash tools/scripts/setup-emsdk.sh"
  exit 1
fi

source tools/emsdk/emsdk_env.sh
pnpm nx build bluequickjs-playground
node apps/bluequickjs-playground/scripts/generate-playground-data.mjs
exec pnpm vite --host --port 4325 --config apps/bluequickjs-playground/vite.config.mts
