#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

bash tools/scripts/prepare-quickjs-source.sh

node -e '
  const fs = require("fs");
  const manifest = JSON.parse(
    fs.readFileSync("vendor/quickjs-patches/manifest.json", "utf8"),
  );
  const stamp = JSON.parse(
    fs.readFileSync("vendor/quickjs/.blue-quickjs-source.json", "utf8"),
  );
  const expected = {
    baseCommit: manifest.baseCommit,
    headCommit: manifest.headCommit,
    patchCount: manifest.patchCount,
    baseArchive: manifest.baseArchive ?? null,
    baseArchiveSha256: manifest.baseArchiveSha256 ?? null,
  };
  const mismatches = Object.entries(expected).filter(
    ([key, value]) => stamp[key] !== value,
  );
  if (mismatches.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          mismatches,
          expected,
          actual: stamp,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceStamp: "vendor/quickjs/.blue-quickjs-source.json",
        baseArchive: stamp.baseArchive,
        patchCount: stamp.patchCount,
      },
      null,
      2,
    ),
  );
'
