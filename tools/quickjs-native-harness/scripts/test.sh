#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"
BIN="${REPO_ROOT}/tools/quickjs-native-harness/dist/quickjs-native-harness"

# Nx already runs the build target before this test target. Rebuild only when
# the harness binary is missing so CI logs keep the actual test failure visible.
if [[ ! -x "${BIN}" ]]; then
  "${SCRIPT_DIR}/build.sh" >/dev/null
fi

HOST_MANIFEST_HEX="$(tr -d '\r\n' < "${REPO_ROOT}/libs/test-harness/fixtures/abi-manifest/host-v1.bytes.hex")"
HOST_MANIFEST_HASH="$(tr -d '\r\n' < "${REPO_ROOT}/libs/test-harness/fixtures/abi-manifest/host-v1.hash")"
COMMON_ARGS=(--abi-manifest-hex "${HOST_MANIFEST_HEX}" --abi-manifest-hash "${HOST_MANIFEST_HASH}")
SHA_EMPTY="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
SHA_ABC="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
SHA_LONG="248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
HOST_ERR_ENVELOPE_HEX="a263657272a164636f6465694e4f545f464f554e4465756e69747303"
HOST_INVALID_ENVELOPE_HEX="a1626f6b01"
HOST_OK_ENVELOPE_HEX="a2626f6ba16576616c75656568656c6c6f65756e69747305"
HOST_UNITS_STRING_HEX="a2626f6b0165756e6974736135"
HOST_UNITS_FLOAT_HEX="a2626f6b0165756e697473fb3ff8000000000000"
HOST_ERR_CODE_NUMBER_HEX="a263657272a164636f6465187b65756e69747300"
HOST_UNITS_ZERO_HEX="a2626f6b0065756e69747300"
HOST_UNITS_ONE_HEX="a2626f6b0065756e69747301"

assert_host_call() {
  local name="$1"
  local expected="$2"
  shift 2

  local output
  output="$("${BIN}" "${COMMON_ARGS[@]}" "$@" || true)"

  if [[ "${output}" != "${expected}" ]]; then
    echo "Harness host_call mismatch for '${name}'" >&2
    echo " expected: ${expected}" >&2
    echo "   actual: ${output}" >&2
    exit 1
  fi
}

assert_cli() {
  local name="$1"
  local expected="$2"
  shift 2

  local output
  output="$("${BIN}" "$@" || true)"

  if [[ "${output}" != "${expected}" ]]; then
    echo "Harness CLI mismatch for '${name}'" >&2
    echo " expected: ${expected}" >&2
    echo "   actual: ${output}" >&2
    exit 1
  fi
}

assert_sha() {
  local name="$1"
  local hex="$2"
  local expected="$3"

  local output
  output="$("${BIN}" --sha256-hex "${hex}" || true)"

  if [[ "${output}" != "${expected}" ]]; then
    echo "SHA mismatch for '${name}'" >&2
    echo " expected: ${expected}" >&2
    echo "   actual: ${output}" >&2
    exit 1
  fi
}

assert_reject() {
  local name="$1"
  shift
  if "${BIN}" "$@" >/dev/null 2>&1; then
    echo "Expected failure for '${name}', but command succeeded" >&2
    exit 1
  fi
}

assert_cli "eval smoke" "RESULT 3" "${COMMON_ARGS[@]}" --eval "1 + 2"
assert_sha "sha256 empty" "" "SHA256 ${SHA_EMPTY}"
assert_sha "sha256 abc" "616263" "SHA256 ${SHA_ABC}"
assert_sha "sha256 long" "6162636462636465636465666465666765666768666768696768696a68696a6b696a6b6c6a6b6c6d6b6c6d6e6c6d6e6f6d6e6f706e6f7071" "SHA256 ${SHA_LONG}"
assert_reject "dv-decode with sha256" --dv-decode "a0" --sha256-hex "${SHA_EMPTY}"
assert_host_call "host_call echo" "HOSTCALL 0a0b0c GAS remaining=100 used=0" --host-call "0a0b0c" --gas-limit 100 --report-gas
assert_host_call "host_call request limit" "ERROR TypeError: host_call request exceeds max_request_bytes" --host-call "010203" --host-max-request 2
assert_host_call "host_call response limit" "ERROR HostError: host/transport" --host-call "0a0b0c" --host-max-request 3 --host-max-response 2
assert_host_call "host_call reentrancy guard" "ERROR TypeError: host_call is already in progress" --host-call "aa" --host-reentrant
assert_host_call "host_call dispatcher exception" "ERROR TypeError: host stub exception" --host-call "aa" --host-exception
assert_host_call "host_call err envelope" "ERROR HostError: host/not_found" --host-call "${HOST_ERR_ENVELOPE_HEX}" --host-parse-envelope --host-max-units 10
assert_host_call "host_call envelope invalid" "ERROR HostError: host/envelope_invalid" --host-call "${HOST_INVALID_ENVELOPE_HEX}" --host-parse-envelope
assert_host_call "host_call units must be number" "ERROR HostError: host/envelope_invalid" --host-call "${HOST_UNITS_STRING_HEX}" --host-parse-envelope
assert_host_call "host_call units must be integer" "ERROR HostError: host/envelope_invalid" --host-call "${HOST_UNITS_FLOAT_HEX}" --host-parse-envelope
assert_host_call "host_call err.code must be string" "ERROR HostError: host/envelope_invalid" --host-call "${HOST_ERR_CODE_NUMBER_HEX}" --host-parse-envelope
assert_host_call "host_call max_units zero allowed" "HOSTRESP 0 UNITS 0" --host-call "${HOST_UNITS_ZERO_HEX}" --host-parse-envelope --host-max-units 0
assert_host_call "host_call units above max_units zero" "ERROR HostError: host/envelope_invalid" --host-call "${HOST_UNITS_ONE_HEX}" --host-parse-envelope --host-max-units 0
assert_host_call "host_call ok envelope" "HOSTRESP {\"value\":\"hello\"} UNITS 5" --host-call "${HOST_OK_ENVELOPE_HEX}" --host-parse-envelope --host-max-units 10

if [[ "${NATIVE_PARITY_STRICT:-0}" == "1" ]]; then
  echo "Running cross-runtime strict parity report suite"
  node "${SCRIPT_DIR}/parity-report.mjs" --assert-match
else
  echo "Running cross-runtime diagnostic parity report suite"
  node "${SCRIPT_DIR}/parity-report.mjs"
fi

echo "quickjs-native-harness test passed"
