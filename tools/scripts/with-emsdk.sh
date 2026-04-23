#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export EMSDK_QUIET=1
source "$ROOT/tools/emsdk/emsdk_env.sh" >/dev/null
exec "$@"
