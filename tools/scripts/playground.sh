#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

step() {
  echo "➡️  $1"
}

ok() {
  echo "✅ $1"
}

fail() {
  echo "❌ $1" >&2
  exit 1
}

EMSDK_ENV="$ROOT/tools/emsdk/emsdk_env.sh"
PLAYGROUND_SCRIPT="$ROOT/apps/bluequickjs-playground/scripts/dev.sh"

if [ ! -f "$EMSDK_ENV" ]; then
  fail "Emscripten SDK not found. Run: pnpm setup"
fi

if [ ! -f "$PLAYGROUND_SCRIPT" ]; then
  fail "Playground script not found at $PLAYGROUND_SCRIPT"
fi

step "Loading Emscripten environment"
source "$EMSDK_ENV" >/dev/null
ok "Emscripten ready"

step "Starting playground"
echo

exec bash "$PLAYGROUND_SCRIPT"