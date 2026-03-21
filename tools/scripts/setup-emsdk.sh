#!/usr/bin/env bash
set -euo pipefail

# Installs and activates the pinned emsdk version into tools/emsdk.
# Idempotent: safe to rerun.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
EMSDK_VERSION="$(cat "${SCRIPT_DIR}/emsdk-version.txt")"
EMSDK_DIR="${REPO_ROOT}/tools/emsdk"

run_with_retry() {
  local step_name="$1"
  shift

  if "$@"; then
    return 0
  fi

  echo "emsdk ${step_name} failed; retrying once..." >&2
  sleep 2

  if "$@"; then
    return 0
  fi

  cat >&2 <<'EOF'
emsdk setup failed twice.

If you saw a process get killed part-way through install, rerun:
  bash tools/scripts/setup-emsdk.sh

The script is idempotent and safe to retry after a partial install.
EOF
  return 1
}

if [ ! -d "${EMSDK_DIR}" ]; then
  git clone https://github.com/emscripten-core/emsdk.git "${EMSDK_DIR}"
fi

cd "${EMSDK_DIR}"

# Ensure we know about new tags/releases before installing.
git fetch --tags origin

run_with_retry "install" ./emsdk install "${EMSDK_VERSION}"
run_with_retry "activate" ./emsdk activate "${EMSDK_VERSION}"

cat <<'EOF'
Emscripten installed and activated.
To use in the current shell:
  source tools/emsdk/emsdk_env.sh
EOF
