#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

MANIFEST_PATH="${REPO_ROOT}/vendor/quickjs-patches/manifest.json"
TARGET_DIR="${REPO_ROOT}/vendor/quickjs"
CACHE_DIR="${REPO_ROOT}/vendor/.quickjs-cache"
CACHE_REPO="${CACHE_DIR}/upstream.git"
STAMP_FILE="${TARGET_DIR}/.blue-quickjs-source.json"
LOCK_DIR="${REPO_ROOT}/vendor/.quickjs-lock"

if [[ ! -f "${MANIFEST_PATH}" ]]; then
  echo "QuickJS patch manifest not found at ${MANIFEST_PATH}" >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to prepare vendor/quickjs" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to read ${MANIFEST_PATH}" >&2
  exit 1
fi

cleanup_lock() {
  if [[ -d "${LOCK_DIR}" ]]; then
    rmdir "${LOCK_DIR}" 2>/dev/null || true
  fi
}

acquire_lock() {
  local attempt=0
  until mkdir "${LOCK_DIR}" 2>/dev/null; do
    attempt=$((attempt + 1))
    if (( attempt == 1 )); then
      echo "Waiting for QuickJS source preparation lock at ${LOCK_DIR}" >&2
    fi
    sleep 1
  done
}

acquire_lock
trap cleanup_lock EXIT

readarray -t MANIFEST_FIELDS < <(
  node -e '
    const fs = require("fs");
    const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (!Number.isInteger(manifest.patchCount) || manifest.patchCount < 0) {
      console.error(
        `Invalid patchCount in ${process.argv[1]}: ${String(manifest.patchCount)}`,
      );
      process.exit(1);
    }
    console.log(manifest.baseCommit);
    console.log(manifest.headCommit);
    console.log(manifest.patchDirectory);
    console.log(String(manifest.patchCount));
    console.log(manifest.upstreamUrl ?? "https://github.com/bellard/quickjs.git");
  ' "${MANIFEST_PATH}"
)

BASE_COMMIT="${MANIFEST_FIELDS[0]}"
HEAD_COMMIT="${MANIFEST_FIELDS[1]}"
PATCH_DIR="${REPO_ROOT}/${MANIFEST_FIELDS[2]}"
PATCH_COUNT="${MANIFEST_FIELDS[3]}"
UPSTREAM_URL="${MANIFEST_FIELDS[4]}"

if [[ ! -d "${PATCH_DIR}" ]]; then
  echo "QuickJS patch directory not found at ${PATCH_DIR}" >&2
  exit 1
fi

PATCH_FILES=("${PATCH_DIR}"/*.patch)
if [[ ! -e "${PATCH_FILES[0]}" ]]; then
  echo "No patch files found under ${PATCH_DIR}" >&2
  exit 1
fi

if (( ${#PATCH_FILES[@]} != PATCH_COUNT )); then
  echo "Patch count mismatch: manifest says ${PATCH_COUNT}, found ${#PATCH_FILES[@]}" >&2
  exit 1
fi

if [[ -f "${STAMP_FILE}" ]]; then
  if node -e '
    const fs = require("fs");
    const stamp = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.exit(
      stamp.baseCommit === process.argv[2] &&
      stamp.headCommit === process.argv[3] &&
      String(stamp.patchCount) === process.argv[4]
        ? 0
        : 1,
    );
  ' "${STAMP_FILE}" "${BASE_COMMIT}" "${HEAD_COMMIT}" "${PATCH_COUNT}"; then
    echo "QuickJS source is already prepared at ${TARGET_DIR}" >&2
    exit 0
  fi
fi

mkdir -p "${CACHE_DIR}"

seed_cache_from_existing_checkout() {
  local checkout_dir="$1"
  if ! git -C "${checkout_dir}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 1
  fi

  if ! git -C "${checkout_dir}" rev-parse --verify "${BASE_COMMIT}^{commit}" >/dev/null 2>&1; then
    return 1
  fi

  git clone --quiet --mirror --no-local "${checkout_dir}" "${CACHE_REPO}"
}

if [[ ! -d "${CACHE_REPO}" ]]; then
  if ! seed_cache_from_existing_checkout "${TARGET_DIR}"; then
    git clone --quiet --mirror "${UPSTREAM_URL}" "${CACHE_REPO}"
  fi
else
  git -C "${CACHE_REPO}" fetch --quiet --prune --tags origin || true
fi

if ! git -C "${CACHE_REPO}" rev-parse --verify "${BASE_COMMIT}^{commit}" >/dev/null 2>&1; then
  echo "Base commit ${BASE_COMMIT} is not available in ${CACHE_REPO}" >&2
  echo "Delete ${CACHE_REPO} and rerun once network access to ${UPSTREAM_URL} is available." >&2
  exit 1
fi

if [[ -e "${TARGET_DIR}" && ! -f "${STAMP_FILE}" ]]; then
  BACKUP_DIR="${TARGET_DIR}.backup.$(date +%Y%m%d%H%M%S)"
  mv "${TARGET_DIR}" "${BACKUP_DIR}"
  echo "Existing vendor/quickjs was moved to ${BACKUP_DIR}" >&2
fi

if [[ -f "${STAMP_FILE}" ]]; then
  rm -rf "${TARGET_DIR}"
fi

TMP_DIR="$(mktemp -d "${REPO_ROOT}/vendor/.quickjs-tmp.XXXXXX")"
trap 'rm -rf "${TMP_DIR}"; cleanup_lock' EXIT

git clone --quiet --no-checkout --no-local "${CACHE_REPO}" "${TMP_DIR}"
git -C "${TMP_DIR}" checkout --quiet "${BASE_COMMIT}"
git -C "${TMP_DIR}" remote set-url origin "${UPSTREAM_URL}" || true
git -C "${TMP_DIR}" \
  -c user.name='blue-quickjs automation' \
  -c user.email='automation@blue-quickjs.local' \
  am --quiet --committer-date-is-author-date "${PATCH_FILES[@]}"

node -e '
  const fs = require("fs");
  fs.writeFileSync(
    process.argv[1],
    JSON.stringify(
      {
        preparedAt: new Date().toISOString(),
        baseCommit: process.argv[2],
        headCommit: process.argv[3],
        patchCount: Number(process.argv[4]),
        upstreamUrl: process.argv[5],
      },
      null,
      2,
    ) + "\n",
  );
' "${TMP_DIR}/.blue-quickjs-source.json" "${BASE_COMMIT}" "${HEAD_COMMIT}" "${PATCH_COUNT}" "${UPSTREAM_URL}"

rm -rf "${TARGET_DIR}"
mv "${TMP_DIR}" "${TARGET_DIR}"
trap - EXIT
cleanup_lock

echo "Prepared QuickJS source at ${TARGET_DIR}" >&2
