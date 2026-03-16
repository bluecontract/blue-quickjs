import { parseArgMap } from './cli.js';

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
});
