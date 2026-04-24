#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT"

echo "🔧 Setting up development environment..."
echo

step() {
  echo "➡️  $1"
}

ok() {
  echo "✅ $1"
}

skip() {
  echo "↪️  $1 (already done)"
}

step "Installing pnpm dependencies"
pnpm install
ok "Dependencies installed"

step "Preparing QuickJS source from patch series"
bash tools/scripts/prepare-quickjs-source.sh
ok "QuickJS source ready"


EMSDK_DIR="$ROOT/tools/emsdk"
if [ ! -d "$EMSDK_DIR" ]; then
  step "Installing Emscripten SDK"
  bash tools/scripts/setup-emsdk.sh
  ok "Emscripten SDK installed"
else
  skip "Emscripten SDK"
fi

source "$EMSDK_DIR/emsdk_env.sh" >/dev/null
ok "Emscripten environment loaded"

if ! pnpm exec playwright install --help >/dev/null 2>&1; then
  step "Installing Playwright"
  pnpm exec playwright install chromium
  ok "Playwright installed"
else
  step "Ensuring Chromium is installed"
  pnpm exec playwright install chromium >/dev/null 2>&1 || true
  ok "Chromium ready"
fi

echo
echo "🎉 Setup complete!"
echo
echo "Next steps:"
echo "  pnpm verify       # run smoke tests"
echo "  pnpm playground   # open browser playground"
