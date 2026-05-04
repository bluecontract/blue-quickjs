import { encodeDv } from '@blue-quickjs/dv';
import {
  MODULE_PACK_FIXTURES,
  type ModulePackFixture,
} from './module-pack-fixtures.js';
import {
  hasBuiltNativeHarness,
  hostManifestArgs,
  parseNativeParityOutput,
  runNativeHarness,
  sha256Hex,
  type NativeParitySnapshot,
} from './native-harness-test-utils.js';

const MODULE_PACK_NATIVE_BASELINES: Record<string, NativeParitySnapshot> = {
  'module-pack-default-export': {
    ok: true,
    valueHash:
      'ca358758f6d27e6cf45272937977a748fd88391db679ceda7dc7bf1f005ee879',
    errorCode: null,
    errorTag: null,
    gasUsed: '204',
    gasRemaining: '49796',
    tapeHash: null,
    tapeLength: 0,
  },
  'module-pack-named-export': {
    ok: true,
    valueHash:
      '7f83f7bda2d63959d34767689f06d47576683d378d9eb8d09386c9a020395c53',
    errorCode: null,
    errorTag: null,
    gasUsed: '221',
    gasRemaining: '49779',
    tapeHash: null,
    tapeLength: 0,
  },
  'module-pack-cyclic-imports': {
    ok: true,
    valueHash:
      '7f83f7bda2d63959d34767689f06d47576683d378d9eb8d09386c9a020395c53',
    errorCode: null,
    errorTag: null,
    gasUsed: '361',
    gasRemaining: '49639',
    tapeHash: null,
    tapeLength: 0,
  },
  'module-pack-host-call-tape': {
    ok: true,
    valueHash:
      'da95a2e5e931c6478e2dbc7d03b381337d481020e16179cc7c45e0b4e3bf13fd',
    errorCode: null,
    errorTag: null,
    gasUsed: '208',
    gasRemaining: '49792',
    tapeHash:
      'a5b1bdd5ceb469c9dbe33cceebff0225b36b30496f7af9a7d124bdaf7976b52d',
    tapeLength: 1,
  },
  'module-pack-async-import-host-call': {
    ok: true,
    valueHash:
      '7f83f7bda2d63959d34767689f06d47576683d378d9eb8d09386c9a020395c53',
    errorCode: null,
    errorTag: null,
    gasUsed: '344',
    gasRemaining: '49656',
    tapeHash:
      'd4d5b078527e86afe555a5e7b3bfe31dc80f0325d14b15d5642dee7d4dc4566c',
    tapeLength: 1,
  },
  'module-pack-kitchen-sink': {
    ok: false,
    valueHash: null,
    errorCode: "ReferenceError: 'document' is not defined",
    errorTag: null,
    gasUsed: '425',
    gasRemaining: '49575',
    tapeHash: null,
    tapeLength: 0,
  },
  'module-pack-missing-entry-specifier': {
    ok: false,
    valueHash: null,
    errorCode: 'MODULE_SPECIFIER_NOT_FOUND',
    errorTag: 'vm/module_pack',
    gasUsed: '0',
    gasRemaining: '50000',
    tapeHash: null,
    tapeLength: 0,
  },
  'module-pack-missing-export': {
    ok: false,
    valueHash: null,
    errorCode: 'MODULE_EXPORT_MISSING',
    errorTag: 'vm/module_pack',
    gasUsed: '134',
    gasRemaining: '49866',
    tapeHash: null,
    tapeLength: 0,
  },
};

const MODULE_PACK_ERROR_CODE_MAP = new Map([
  ['ModuleSpecifierNotFound', 'MODULE_SPECIFIER_NOT_FOUND'],
  ['ModuleExportMissing', 'MODULE_EXPORT_MISSING'],
  ['ModuleResolutionError', 'MODULE_RESOLUTION_ERROR'],
  ['ModuleEvaluationError', 'MODULE_EVALUATION_ERROR'],
]);

describe('module pack parity', () => {
  it('has a built native harness available', () => {
    expect(hasBuiltNativeHarness()).toBe(true);
  });

  test.each(MODULE_PACK_FIXTURES)(
    '$name matches the native baseline snapshot',
    (fixture) => {
      const result = runNativeHarness(buildModulePackArgs(fixture), {
        includeManifest: false,
      });

      expect(result.stderr).toBe('');

      const actual = parseNativeParityOutput(result.stdout, {
        valueToHash: (value: unknown) =>
          sha256Hex(Buffer.from(encodeDv(value))),
        mapErrorCode: (message: string) => mapModulePackErrorCode(message),
      });

      expect(actual).toEqual(MODULE_PACK_NATIVE_BASELINES[fixture.name]);
    },
  );
});

function buildModulePackArgs(fixture: ModulePackFixture): string[] {
  const modulePack = fixture.program.source.modulePack;
  return [
    ...hostManifestArgs,
    '--execution-profile',
    fixture.program.executionProfile,
    '--gas-limit',
    fixture.gasLimit.toString(),
    '--report-gas',
    '--report-tape',
    '--module-entry-specifier',
    modulePack.entrySpecifier,
    '--module-entry-export',
    modulePack.entryExport ?? 'default',
    '--module-pack-json',
    JSON.stringify(modulePack.modules),
  ];
}

function mapModulePackErrorCode(message: string): string | null {
  for (const [needle, code] of MODULE_PACK_ERROR_CODE_MAP) {
    if (message.includes(needle)) {
      return code;
    }
  }

  return null;
}
