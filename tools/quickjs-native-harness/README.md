# quickjs-native-harness

Minimal native harness for the QuickJS fork. Builds a standalone binary that evaluates a JS string and returns deterministic output (`RESULT <json>` or `ERROR <message>`).

## Usage
- Build: `pnpm nx build quickjs-native-harness`
- Test: `pnpm nx test quickjs-native-harness`
- Manual run: `tools/quickjs-native-harness/dist/quickjs-native-harness --eval "1 + 2"`

Notes:
- The runtime currently uses QuickJS defaults; once the deterministic init entrypoint lands in the fork, this harness should switch to that initializer.
- Build artifacts live under `tools/quickjs-native-harness/dist`.
