import { extractStackLocations, parseArgMap } from './cli.js';

describe('blue-quickjs-cli argument parsing', () => {
  it('parses command and key/value options', () => {
    const parsed = parseArgMap([
      'build',
      '--entry',
      'src/main.ts',
      '--profile',
      'compat-binary-v1',
      '--allow-incompatible',
    ]);

    expect(parsed.command).toBe('build');
    expect(parsed.options.get('entry')).toBe('src/main.ts');
    expect(parsed.options.get('profile')).toBe('compat-binary-v1');
    expect(parsed.options.get('allow-incompatible')).toBe(true);
  });

  it('throws on unexpected positional options', () => {
    expect(() => parseArgMap(['run', '--artifact', 'a.json', 'extra'])).toThrow(
      /unexpected positional argument/i,
    );
  });

  it('extracts and de-duplicates stack locations', () => {
    const locations = extractStackLocations(
      'ModuleEvaluationError: Error at src/app.ts:12:4 and src/app.ts:12:4, helper ./entry.js:3:1',
    );

    expect(locations).toEqual([
      { source: 'src/app.ts', line: 12, column: 4 },
      { source: './entry.js', line: 3, column: 1 },
    ]);
  });
});
