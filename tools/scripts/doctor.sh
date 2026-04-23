#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

failures=0

info() {
  echo "➡️  $1"
}

pass() {
  echo "✅ $1"
}

warn() {
  echo "⚠️  $1"
}

fail() {
  echo "❌ $1"
  failures=$((failures + 1))
}

check_cmd() {
  local cmd="$1"
  local label="$2"

  if command -v "$cmd" >/dev/null 2>&1; then
    local version
    version="$("$cmd" --version 2>/dev/null | head -n 1 || true)"
    if [ -n "$version" ]; then
      pass "$label: $version"
    else
      pass "$label is installed"
    fi
  else
    fail "$label is not installed"
  fi
}

echo "🩺 Repo doctor"
echo

info "Checking required commands"
check_cmd git "git"
check_cmd node "node"
check_cmd pnpm "pnpm"
check_cmd bash "bash"

echo
info "Checking repository layout"

if [ -f "$ROOT/package.json" ]; then
  pass "package.json found"
else
  fail "package.json missing at repo root"
fi

if [ -d "$ROOT/vendor/quickjs" ]; then
  pass "vendor/quickjs directory found"
else
  fail "vendor/quickjs missing; run: git submodule update --init --recursive vendor/quickjs"
fi

if [ -f "$ROOT/tools/scripts/setup-emsdk.sh" ]; then
  pass "setup-emsdk.sh found"
else
  fail "tools/scripts/setup-emsdk.sh missing"
fi

if [ -f "$ROOT/tools/emsdk/emsdk_env.sh" ]; then
  pass "emsdk env script found"
else
  fail "tools/emsdk/emsdk_env.sh missing; run: pnpm setup"
fi

echo
info "Checking Node workspace state"

if [ -d "$ROOT/node_modules" ]; then
  pass "node_modules present"
else
  fail "node_modules missing; run: pnpm install"
fi

echo
info "Checking Playwright Chromium"

if pnpm exec playwright --version >/dev/null 2>&1; then
  pass "Playwright CLI available"
else
  fail "Playwright CLI unavailable; run: pnpm install"
fi

PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
if [ -d "$PLAYWRIGHT_BROWSERS_PATH" ] && find "$PLAYWRIGHT_BROWSERS_PATH" -maxdepth 1 -iname "*chromium*" | grep -q .; then
  pass "Chromium browser appears installed"
else
  warn "Chromium browser not detected in cache; run: pnpm exec playwright install --with-deps chromium"
fi

echo
info "Checking Emscripten toolchain"

EMSDK_ENV="$ROOT/tools/emsdk/emsdk_env.sh"
if [ -f "$EMSDK_ENV" ]; then
  # shellcheck disable=SC1090
  source "$EMSDK_ENV" >/dev/null

  if command -v emcc >/dev/null 2>&1; then
    pass "emcc available: $(emcc --version 2>/dev/null | head -n 1)"
  else
    fail "emcc not available after sourcing emsdk_env.sh"
  fi

  if command -v em++ >/dev/null 2>&1; then
    pass "em++ available"
  else
    fail "em++ not available after sourcing emsdk_env.sh"
  fi
fi

echo
info "Checking project scripts"

if [ -f "$ROOT/apps/bluequickjs-playground/scripts/dev.sh" ]; then
  pass "playground script found"
else
  fail "playground script missing"
fi

if [ -d "$ROOT/e2e/consumer-proof-app" ]; then
  pass "consumer proof app found"
else
  warn "consumer proof app directory missing"
fi

echo
if [ "$failures" -eq 0 ]; then
  echo "🎉 Doctor finished: no blocking issues found."
else
  echo "🚨 Doctor finished: $failures blocking issue(s) found."
  exit 1
fi