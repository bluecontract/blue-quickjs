# Glossary

## ABI manifest

The canonical manifest that defines which host functions exist, what numeric
IDs they use, and which ABI version an artifact expects.

## Consensus-safe

Part of the current release contract. Today that means `wasm-node` and
`wasm-browser` running the canonical `wasm32` release engine with exact parity
requirements.

## Diagnostic-only

Useful for debugging, investigation, or reconciliation, but not part of the
current consensus release gate. Native and WebKit runs currently live here.

## DV / DV1

Deterministic Value encoding used at host/runtime boundaries for canonical
structured values that do not include byte strings.

## DV2

Versioned extension of DV that adds canonical bytes support for `Host.v2` and
binary-heavy workloads.

## engineBuildHash

The SHA-256 identity pin for the engine build bytes. Release-mode artifacts use
this to ensure the runtime matches the intended Wasm engine.

## execution profile

A named capability contract that determines which compatibility features are
allowed during execution:

- `baseline-v1`
- `compat-general-v1`
- `compat-binary-v1`

## gasVersion

The version number of the canonical gas schedule expected by an artifact and
runtime.

## host-call tape

The deterministic record of host calls emitted during execution, including
request/response hashes, gas before/after, and units charged.

## ModulePack.v1

The canonical deterministic module graph artifact used to execute static ESM
without runtime network/filesystem/module-registry access.

## OOG boundary

The exact gas limit where execution changes from failure to success, or
vice versa. BlueQuickjs treats this boundary as release-critical evidence for
consensus executors.

## ProgramArtifact.v2

The versioned execution artifact that carries source, profile, ABI pins,
engine pin, gas pin, and source kind.
