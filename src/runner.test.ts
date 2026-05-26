import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run } from './runner.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', 'tests', 'fixtures');

describe('runner.run', () => {
  it('returns exit 1 and grouped output for a project with violations', async () => {
    const result = await run(join(fixturesDir, 'dirty-project'));
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('Habit Hooks: 1 violation');
    expect(result.stdout).toContain('Too many parameters');
    expect(result.stdout).toContain('bad.ts:1');
  });

  it('returns exit 0 and clean header for a clean project', async () => {
    const result = await run(join(fixturesDir, 'clean-project'));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Habit Hooks: clean');
  });

  it('respects per-rule exclude: test files do not trip max-lines-per-function', async () => {
    const result = await run(join(fixturesDir, 'configured-project'));
    expect(result.stdout).not.toContain('Function too long');
  });

  it('applies project config: disables complexity, uses custom prompt for max-params', async () => {
    const result = await run(join(fixturesDir, 'configured-project'));
    expect(result.stdout).toContain('Too many parameters');
    expect(result.stdout).toContain('CUSTOM PROJECT GUIDANCE');
    expect(result.stdout).not.toContain('Function complexity is high');
  });
});
