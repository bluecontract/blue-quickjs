# Host Call ABI (Baseline #2)

Scope: describe the single-dispatcher syscall (`host_call`) and generated `Host.v1` surface per Baseline #2 (e.g., §1.5, §2, §6.4, §9).

## Goals
- Define wire format: `fn_id + request_bytes -> response_bytes` using DV encoding.
- Document gas model for host calls (overhead + size-based) and deterministic error handling.
- Explain manifest-driven codegen for `Host.v1` and ergonomic globals (`document`, `event`, `steps`).

## To document (Baseline #2 refs)
- §1.5/§2: syscall shape, numeric IDs, and dispatcher expectations.
- §6.4/§9: runtime ergonomics and safety rules for the host surface.
- Cross-link DV encoding (`dv-wire-format.md`) and manifest hashing (`abi-manifest.md`).

## TODO
- Add response/error envelope description.
- Include examples once runtime scaffolding is in place.
