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
# shellcheck disable=SC1090
source "$EMSDK_ENV" >/dev/null
ok "Emscripten environment loaded"

step "Preparing artifact directories"
mkdir -p \
  artifacts/reproducibility-consensus \
  artifacts/workload-certification \
  artifacts/consumer-proof/tarballs \
  artifacts/release-evidence
ok "Artifact directories ready"

step "Generating consensus reproducibility report"
node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs \
  --out-dir artifacts/reproducibility-consensus
ok "Consensus reproducibility report generated"

step "Generating workload certification report"
node apps/ecosystem-certifier/scripts/archive-workload-certification-report.mjs \
  --out-dir artifacts/workload-certification
ok "Workload certification report generated"

step "Running OOG boundary certification"
node apps/ecosystem-certifier/scripts/run-oog-boundary-certification.mjs \
  --out-dir artifacts/workload-certification
ok "OOG boundary certification generated"

step "Packing public tarballs"
node tools/workload-certification/pack-public-tarballs.mjs \
  --out-dir artifacts/consumer-proof/tarballs
ok "Public tarballs packed"

step "Installing tarballs into consumer proof app"
pnpm --dir e2e/consumer-proof-app run install:tarballs \
  -- --tarball-dir ../../artifacts/consumer-proof/tarballs
ok "Consumer proof app tarballs installed"

step "Running consumer proof reproducibility check"
pnpm --dir e2e/consumer-proof-app run repro
ok "Consumer proof reproducibility check passed"

step "Synthesizing release evidence bundle"
pnpm release-evidence:synthesize -- --out-dir artifacts/release-evidence
ok "Release evidence bundle synthesized"

echo
echo "🎉 Evidence generation complete!"
echo
echo "Artifacts:"
echo "  - artifacts/reproducibility-consensus"
echo "  - artifacts/workload-certification"
echo "  - artifacts/consumer-proof/tarballs"
echo "  - artifacts/release-evidence"
echo
echo "Next step:"
echo "  pnpm evidence:verify"
