#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"
PROJECT_ROOT="${REPO_ROOT}/libs/quickjs-wasm-build"
QJS_DIR="${REPO_ROOT}/vendor/quickjs"
OUT_DIR="${PROJECT_ROOT}/dist"
METADATA_BASENAME="quickjs-wasm-build.metadata.json"
VARIANTS_RAW="${WASM_VARIANTS:-wasm32}"
WASM_INITIAL_MEMORY_BYTES=$((32 * 1024 * 1024))
WASM_STACK_SIZE_BYTES=$((1 * 1024 * 1024))
ALLOW_MEMORY_GROWTH=0
SOURCE_DATE_EPOCH_DEFAULT=1704067200

ENV_SCRIPT="${REPO_ROOT}/tools/emsdk/emsdk_env.sh"
if [[ ! -f "${ENV_SCRIPT}" ]]; then
  echo "Emscripten env not found at ${ENV_SCRIPT}. Run tools/scripts/setup-emsdk.sh first." >&2
  exit 1
fi

# shellcheck source=/dev/null
source "${ENV_SCRIPT}" >/dev/null

if ! command -v emcc >/dev/null 2>&1; then
  echo "emcc not available after sourcing ${ENV_SCRIPT}" >&2
  exit 1
fi

export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-${SOURCE_DATE_EPOCH_DEFAULT}}"
export QJS_WASM_INITIAL_MEMORY_BYTES="${WASM_INITIAL_MEMORY_BYTES}"
export QJS_WASM_MAX_MEMORY_BYTES="${WASM_INITIAL_MEMORY_BYTES}"
export QJS_WASM_STACK_SIZE_BYTES="${WASM_STACK_SIZE_BYTES}"
export QJS_WASM_ALLOW_MEMORY_GROWTH="${ALLOW_MEMORY_GROWTH}"

DETERMINISTIC_FLAGS=(
  "-sDETERMINISTIC=1"
  "-sFILESYSTEM=0"
  "-sALLOW_MEMORY_GROWTH=${ALLOW_MEMORY_GROWTH}"
  "-sINITIAL_MEMORY=${WASM_INITIAL_MEMORY_BYTES}"
  "-sMAXIMUM_MEMORY=${WASM_INITIAL_MEMORY_BYTES}"
  "-sSTACK_SIZE=${WASM_STACK_SIZE_BYTES}"
  "-sALLOW_TABLE_GROWTH=0"
  "-sENVIRONMENT=node,web"
  "-sNO_EXIT_RUNTIME=1"
)

export QJS_WASM_DETERMINISTIC_FLAGS="$(printf '%s\n' "${DETERMINISTIC_FLAGS[@]}")"

VERSION="$(cat "${QJS_DIR}/VERSION")"

SRC_FILES=(
  "${QJS_DIR}/quickjs.c"
  "${QJS_DIR}/quickjs-host.c"
  "${QJS_DIR}/quickjs-dv.c"
  "${QJS_DIR}/quickjs-sha256.c"
  "${QJS_DIR}/dtoa.c"
  "${QJS_DIR}/libregexp.c"
  "${QJS_DIR}/libunicode.c"
  "${QJS_DIR}/cutils.c"
  "${QJS_DIR}/quickjs-libc.c"
  "${PROJECT_ROOT}/src/wasm/quickjs_wasm.c"
)

COMMON_EMCC_FLAGS=(
  -std=gnu11
  -O2
  -Wall
  -Wextra
  -Wno-unused-parameter
  -Wno-missing-field-initializers
  -funsigned-char
  -fwrapv
  -I"${QJS_DIR}"
  "-ffile-prefix-map=${REPO_ROOT}=."
  "-ffile-prefix-map=${QJS_DIR}=vendor/quickjs"
  -D_GNU_SOURCE
  "-DCONFIG_VERSION=\"${VERSION}\""
  -sDETERMINISTIC=1
  -sASSERTIONS=0
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sENVIRONMENT=node,web
  -sNO_EXIT_RUNTIME=1
  -sINITIAL_MEMORY="${WASM_INITIAL_MEMORY_BYTES}"
  -sMAXIMUM_MEMORY="${WASM_INITIAL_MEMORY_BYTES}"
  -sALLOW_MEMORY_GROWTH="${ALLOW_MEMORY_GROWTH}"
  -sALLOW_TABLE_GROWTH=0
  -sSTACK_SIZE="${WASM_STACK_SIZE_BYTES}"
  -sFILESYSTEM=0
  # host_call is provided by the embedder; keep undefined-symbols lax so the import is allowed.
  -sERROR_ON_UNDEFINED_SYMBOLS=0
  -sEXPORT_NAME=QuickJSGasWasm
  -sWASM_BIGINT=1
  "-sEXPORTED_FUNCTIONS=['_qjs_eval','_qjs_free_output','_malloc','_free']"
"-sEXPORTED_RUNTIME_METHODS=['cwrap','ccall','UTF8ToString','lengthBytesUTF8']"
)

BUILT_VARIANTS=()

inject_host_imports() {
  local js_file="$1"
  node -e "
    const fs = require('fs');
    const file = process.argv[1];
    let source = fs.readFileSync(file, 'utf8');
    if (!source.includes('var info={\"env\":wasmImports,\"wasi_snapshot_preview1\":wasmImports};')) {
      throw new Error(\`Unable to find wasm import object in \${file} for host injection\`);
    }
    if (!source.includes('info[\"host\"]=')) {
      const marker = 'var info={\"env\":wasmImports,\"wasi_snapshot_preview1\":wasmImports};';
      source = source.replace(
        marker,
        \`\${marker}info[\"host\"]=Module[\"host\"]||{host_call:function(){return 0xffffffff;}};\`,
      );
      fs.writeFileSync(file, source);
    }
  " -- "${js_file}"
}

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

VARIANTS_RAW_CLEAN="${VARIANTS_RAW//[[:space:]]/}"
IFS=',' read -ra REQUESTED_VARIANTS <<< "${VARIANTS_RAW_CLEAN}"
if [[ ${#REQUESTED_VARIANTS[@]} -eq 0 ]]; then
  REQUESTED_VARIANTS=("wasm32")
fi

for variant in "${REQUESTED_VARIANTS[@]}"; do
  normalized_variant="$(echo "${variant}" | tr '[:upper:]' '[:lower:]')"
  suffix=""
  declare -a variant_flags=()
  emcc_args=("${SRC_FILES[@]}" "${COMMON_EMCC_FLAGS[@]}")
  variant_flags_str=""

  case "${normalized_variant}" in
    wasm32)
      suffix=""
      ;;
    wasm64 | memory64 | mem64)
      suffix="-wasm64"
      variant_flags+=(-sMEMORY64=1)
      normalized_variant="wasm64"
      emcc_args+=("${variant_flags[@]}")
      ;;
    *)
      echo "Unknown WASM variant '${variant}'. Expected wasm32 or wasm64." >&2
      exit 1
      ;;
  esac

  emcc "${emcc_args[@]}" -o "${OUT_DIR}/quickjs-eval${suffix}.js"
  inject_host_imports "${OUT_DIR}/quickjs-eval${suffix}.js"

  if [[ ${#variant_flags[@]} -gt 0 ]]; then
    variant_flags_str="$(IFS=','; echo "${variant_flags[*]}")"
  fi

  BUILT_VARIANTS+=("${normalized_variant}:${OUT_DIR}/quickjs-eval${suffix}.wasm:${OUT_DIR}/quickjs-eval${suffix}.js:${variant_flags_str}")
  echo "Built QuickJS wasm harness (${normalized_variant}):"
  echo "  JS:   ${OUT_DIR}/quickjs-eval${suffix}.js"
  echo "  Wasm: ${OUT_DIR}/quickjs-eval${suffix}.wasm"
done

if [[ ${#BUILT_VARIANTS[@]} -eq 0 ]]; then
  echo "No wasm variants built; cannot write metadata." >&2
  exit 1
fi

node - "${OUT_DIR}" "${QJS_DIR}" "${REPO_ROOT}/tools/scripts/emsdk-version.txt" "${METADATA_BASENAME}" "${BUILT_VARIANTS[@]}" <<'NODE'
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [outDir, qjsDir, emsdkVersionFile, metadataBasename, ...variantArgs] = process.argv.slice(2);
if (variantArgs.length === 0) {
  throw new Error('No variant arguments passed to metadata writer.');
}

const parseUintEnv = (name) => {
  const raw = process.env[name];
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseFlagsEnv = (name) =>
  (process.env[name] ?? '')
    .split(/\r?\n/)
    .map((flag) => flag.trim())
    .filter(Boolean);

const readTrim = (filePath) => fs.readFileSync(filePath, 'utf8').trim();
const sha256File = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const statSize = (filePath) => fs.statSync(filePath).size;
const quickjsVersion = readTrim(path.join(qjsDir, 'VERSION'));
let quickjsCommit = null;
try {
  quickjsCommit = execFileSync('git', ['-C', qjsDir, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
} catch {
  quickjsCommit = null;
}

const variants = variantArgs
  .map((entry) => {
    const [variant, wasmPath, loaderPath, variantFlagsRaw = ''] = entry.split(':');
    if (!variant || !wasmPath || !loaderPath) {
      throw new Error(`Invalid variant entry: ${entry}`);
    }
    const variantFlags = variantFlagsRaw
      ? variantFlagsRaw.split(',').map((flag) => flag.trim()).filter(Boolean)
      : [];
    return { variant, wasmPath, loaderPath, variantFlags };
  })
  .sort((a, b) => a.variant.localeCompare(b.variant));

const variantsMeta = {};
for (const entry of variants) {
  const wasm = {
    filename: path.basename(entry.wasmPath),
    sha256: sha256File(entry.wasmPath),
    size: statSize(entry.wasmPath),
  };
  const loader = {
    filename: path.basename(entry.loaderPath),
    sha256: sha256File(entry.loaderPath),
    size: statSize(entry.loaderPath),
  };
  variantsMeta[entry.variant] = {
    engineBuildHash: wasm.sha256,
    wasm,
    loader,
    variantFlags: entry.variantFlags,
  };
}

let engineBuildHash = null;
if (variantsMeta.wasm32?.engineBuildHash) {
  engineBuildHash = variantsMeta.wasm32.engineBuildHash;
} else if (variantsMeta.wasm64?.engineBuildHash) {
  engineBuildHash = variantsMeta.wasm64.engineBuildHash;
} else if (variants.length > 0) {
  engineBuildHash = variantsMeta[variants[0].variant].engineBuildHash;
}

const buildMemory = {
  initial: parseUintEnv('QJS_WASM_INITIAL_MEMORY_BYTES'),
  maximum: parseUintEnv('QJS_WASM_MAX_MEMORY_BYTES'),
  stackSize: parseUintEnv('QJS_WASM_STACK_SIZE_BYTES'),
  allowGrowth: process.env.QJS_WASM_ALLOW_MEMORY_GROWTH === '1',
};

const determinism = {
  sourceDateEpoch: parseUintEnv('SOURCE_DATE_EPOCH'),
  flags: parseFlagsEnv('QJS_WASM_DETERMINISTIC_FLAGS'),
};

const metadata = {
  quickjsVersion,
  quickjsCommit,
  emscriptenVersion: readTrim(emsdkVersionFile),
  engineBuildHash,
  build: {
    memory: buildMemory,
    determinism,
  },
  variants: variantsMeta,
};

const outPath = path.join(outDir, metadataBasename);
fs.writeFileSync(outPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
console.log(`Wrote metadata: ${outPath}`);
NODE

echo "  Metadata: ${OUT_DIR}/${METADATA_BASENAME}"
