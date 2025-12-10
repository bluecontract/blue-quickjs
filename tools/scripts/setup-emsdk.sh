#!/usr/bin/env bash
set -euo pipefail

# Installs and activates the pinned emsdk version into tools/emsdk.
# Idempotent: safe to rerun.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
EMSDK_VERSION="$(cat "${SCRIPT_DIR}/emsdk-version.txt")"
EMSDK_DIR="${REPO_ROOT}/tools/emsdk"

if [ ! -d "${EMSDK_DIR}" ]; then
  git clone https://github.com/emscripten-core/emsdk.git "${EMSDK_DIR}"
fi

cd "${EMSDK_DIR}"

# Ensure we know about new tags/releases before installing.
git fetch --tags origin

./emsdk install "${EMSDK_VERSION}"
./emsdk activate "${EMSDK_VERSION}"

cat <<'EOF'
Emscripten installed and activated.
To use in the current shell:
  source tools/emsdk/emsdk_env.sh
EOF
