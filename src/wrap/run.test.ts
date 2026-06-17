import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { isSpawnSkip, parseJsonStdout, spawnWrapped } from './run.js';
import { runTool } from './shell.js';
import { isSpawnFailure, spawnFailureWarning } from './notices.js';

describe('spawnWrapped', () => {
  it('returns the ShellResult when the tool runs to completion', async () => {
    const result = await spawnWrapped({
      tool: 'echo',
      resolution: { binPath: '/bin/echo', isFallback: false },
      cwd: tmpdir(),
      args: ['hi'],
    });
    expect(isSpawnSkip(result)).toBe(false);
    if (isSpawnSkip(result)) return;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hi');
  });

  it('returns a skipWarning when the binary cannot be spawned', async () => {
    const result = await spawnWrapped({
      tool: 'ghost',
      resolution: { binPath: '/definitely/not/here/ghost-bin', isFallback: false },
      cwd: tmpdir(),
      args: [],
    });
    expect(isSpawnSkip(result)).toBe(true);
    if (!isSpawnSkip(result)) return;
    expect(result.skipWarning).toContain('habit-hooks: ghost skipped');
    expect(result.skipWarning).toContain('ghost-bin');
  });

  it('passes through tool non-zero exits as a ShellResult, not a skip', async () => {
    const result = await spawnWrapped({
      tool: 'node',
      resolution: { binPath: process.execPath, isFallback: false },
      cwd: tmpdir(),
      args: ['-e', 'process.exit(2)'],
    });
    expect(isSpawnSkip(result)).toBe(false);
    if (isSpawnSkip(result)) return;
    expect(result.exitCode).toBe(2);
  });

  // A sensor TIMEOUT must be classified and surfaced as a sensor failure, exactly
  // like a spawn failure: runTool's timeout route yields exitCode -1, isSpawnFailure
  // recognises it, and it becomes a "<tool> skipped" warning (which fails the run).
  it('classifies a real timeout (exitCode -1 via the timeout route) as a sensor failure', async () => {
    const timedOut = await runTool({
      bin: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: tmpdir(),
      timeoutMs: 100,
    });

    expect(timedOut.exitCode).toBe(-1);
    expect(timedOut.warnings[0]).toMatch(/timed out/);
    expect(isSpawnFailure(timedOut)).toBe(true);

    const skipWarning = spawnFailureWarning('eslint', '/repo', timedOut.warnings);
    expect(skipWarning).toContain('habit-hooks: eslint skipped in /repo');
    expect(skipWarning).toContain('timed out');
  });
});

describe('parseJsonStdout', () => {
  it('parses a valid object when startsWith is {', () => {
    expect(parseJsonStdout<{ a: number }>('  {"a":1}  ', '{')).toEqual({ a: 1 });
  });

  it('parses a valid array when startsWith is [', () => {
    expect(parseJsonStdout<number[]>('[1,2,3]', '[')).toEqual([1, 2, 3]);
  });

  it('returns null when stdout is empty', () => {
    expect(parseJsonStdout('', '{')).toBeNull();
    expect(parseJsonStdout('   ', '[')).toBeNull();
  });

  it('returns null when stdout does not start with the expected delimiter', () => {
    expect(parseJsonStdout('plain text', '{')).toBeNull();
    expect(parseJsonStdout('{"a":1}', '[')).toBeNull();
    expect(parseJsonStdout('[1,2]', '{')).toBeNull();
  });

  it('returns null when stdout starts correctly but fails to parse', () => {
    expect(parseJsonStdout('{not json', '{')).toBeNull();
    expect(parseJsonStdout('[1,2,', '[')).toBeNull();
  });
});
