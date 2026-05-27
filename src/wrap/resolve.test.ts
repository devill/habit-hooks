import { describe, expect, it } from 'vitest';
import { requiresNodeRuntime, spawnTarget } from './resolve.js';

describe('resolve', () => {
  it('requiresNodeRuntime is true for .js bins and false otherwise', () => {
    expect(requiresNodeRuntime('/x/y/cli.js')).toBe(true);
    expect(requiresNodeRuntime('/x/y/cli')).toBe(false);
  });

  it('spawnTarget prepends node for .js bins', () => {
    const target = spawnTarget('/x/cli.js', ['--flag', 'value']);
    expect(target.bin).toBe(process.execPath);
    expect(target.args).toEqual(['/x/cli.js', '--flag', 'value']);
  });

  it('spawnTarget invokes the bin directly for non-.js entries', () => {
    const target = spawnTarget('/usr/local/bin/tool', ['--flag']);
    expect(target.bin).toBe('/usr/local/bin/tool');
    expect(target.args).toEqual(['--flag']);
  });
});
