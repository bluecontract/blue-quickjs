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

if [ ! -f "$EMSDK_ENV" ]; then
  fail "Missing $EMSDK_ENV. Run: pnpm setup"
fi

step "Loading Emscripten environment"
source "$EMSDK_ENV" >/dev/null
ok "Emscripten environment loaded"

step "Ensuring Playwright Chromium is installed"
pnpm exec playwright install chromium >/dev/null
ok "Chromium ready"

step "Running smoke-node"
pnpm nx test smoke-node
ok "smoke-node passed"

step "Running smoke-web:e2e"
pnpm nx run smoke-web:e2e
ok "smoke-web:e2e passed"

echo
echo "🎉 Verify complete!"
echo
echo "Validated:"
echo "  - smoke-node"
echo "  - smoke-web:e2e"