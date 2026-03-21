#!/usr/bin/env bash
set -euo pipefail

# Installs and activates the pinned emsdk version into tools/emsdk.
# Idempotent: safe to rerun.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
EMSDK_VERSION="$(cat "${SCRIPT_DIR}/emsdk-version.txt")"
EMSDK_DIR="${REPO_ROOT}/tools/emsdk"
HOST_OS="$(uname -s)"
HOST_ARCH="$(uname -m)"
HOST_PYTHON="$(command -v python3 || command -v python || true)"

run_with_retry() {
  local step_name="$1"
  shift

  if "$@"; then
    return 0
  fi

  if [ "${HOST_OS}" = "Darwin" ]; then
    clear_quarantine_if_possible
  fi

  echo "emsdk ${step_name} failed; retrying once..." >&2
  sleep 2

  if "$@"; then
    return 0
  fi

  if [ "${HOST_OS}" = "Darwin" ] && [ "${HOST_ARCH}" = "arm64" ] && [ -z "${EMSDK_ARCH:-}" ]; then
    echo "emsdk ${step_name} still failed on macOS arm64; retrying with EMSDK_ARCH=x86_64..." >&2
    sleep 2
    if EMSDK_ARCH=x86_64 "$@"; then
      cat >&2 <<'EOF'
emsdk setup succeeded using EMSDK_ARCH=x86_64.

If this machine does not already have Rosetta installed, install it with:
  softwareupdate --install-rosetta --agree-to-license
EOF
      return 0
    fi
  fi

  cat >&2 <<'EOF'
emsdk setup failed twice.

If you saw a process get killed part-way through install, rerun:
  bash tools/scripts/setup-emsdk.sh

The script is idempotent and safe to retry after a partial install.
EOF
  return 1
}

clear_quarantine_if_possible() {
  if ! command -v xattr >/dev/null 2>&1; then
    return 0
  fi

  xattr -dr com.apple.quarantine "${EMSDK_DIR}" >/dev/null 2>&1 || true
}

run_emsdk() {
  if [ -n "${HOST_PYTHON}" ] && [ -f "${EMSDK_DIR}/emsdk.py" ]; then
    EMSDK_PYTHON="${HOST_PYTHON}" "${HOST_PYTHON}" "${EMSDK_DIR}/emsdk.py" "$@"
    return $?
  fi

  "${EMSDK_DIR}/emsdk" "$@"
}

if [ ! -d "${EMSDK_DIR}" ]; then
  git clone https://github.com/emscripten-core/emsdk.git "${EMSDK_DIR}"
fi

cd "${EMSDK_DIR}"

# Ensure we know about new tags/releases before installing.
git fetch --tags origin

run_with_retry "install" run_emsdk install "${EMSDK_VERSION}"
run_with_retry "activate" run_emsdk activate "${EMSDK_VERSION}"

cat <<'EOF'
Emscripten installed and activated.
To use in the current shell:
  source tools/emsdk/emsdk_env.sh
EOF
