#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"
BIN="${REPO_ROOT}/tools/quickjs-native-harness/dist/quickjs-native-harness"

# Ensure build is present.
"${SCRIPT_DIR}/build.sh" >/dev/null

output="$("${BIN}" --eval "1 + 2")"
expected="RESULT 3"

if [[ "${output}" != "${expected}" ]]; then
  echo "Harness output mismatch" >&2
  echo " expected: ${expected}" >&2
  echo "   actual: ${output}" >&2
  exit 1
fi

echo "quickjs-native-harness test passed"
