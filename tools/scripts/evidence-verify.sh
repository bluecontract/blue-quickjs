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

EVIDENCE_DIR="artifacts/release-evidence"

if [ ! -d "$EVIDENCE_DIR" ]; then
  fail "Missing $EVIDENCE_DIR. Run: pnpm evidence"
fi

step "Verifying release evidence bundle"
pnpm release-evidence:verify -- --evidence-dir "$EVIDENCE_DIR"
ok "Release evidence bundle verified"

echo
echo "🎉 Evidence verification complete!"
echo
echo "Verified:"
echo "  - $EVIDENCE_DIR"