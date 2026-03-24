#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
QJS_DIR="${REPO_ROOT}/vendor/quickjs"
QJS_VERSION_FILE="${QJS_DIR}/VERSION"

if [ -f "${QJS_VERSION_FILE}" ]; then
  exit 0
fi

echo "QuickJS submodule is missing or incomplete; attempting to initialize vendor/quickjs..." >&2

if ! command -v git >/dev/null 2>&1; then
  echo "git is not available, so vendor/quickjs cannot be initialized automatically." >&2
  echo "Run: git submodule update --init --recursive vendor/quickjs" >&2
  exit 1
fi

(
  cd "${REPO_ROOT}"
  git submodule update --init --recursive vendor/quickjs
)

if [ ! -f "${QJS_VERSION_FILE}" ]; then
  echo "vendor/quickjs is still incomplete after submodule initialization." >&2
  echo "Expected file missing: ${QJS_VERSION_FILE}" >&2
  echo "Run: git submodule update --init --recursive vendor/quickjs" >&2
  exit 1
fi

echo "QuickJS submodule is ready." >&2
