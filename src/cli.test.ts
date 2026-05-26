import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(repoRoot, 'dist', 'cli.js');
const fixturesDir = join(repoRoot, 'tests', 'fixtures');

describe('cli', () => {
  beforeAll(() => {
    if (!existsSync(cliPath)) {
      const build = spawnSync('npm', ['run', 'build'], { cwd: repoRoot, encoding: 'utf8' });
      if (build.status !== 0) {
        throw new Error(`build failed: ${build.stderr}`);
      }
    }
  }, 60_000);

  it('prints version with --version', () => {
    const result = spawnSync('node', [cliPath, '--version'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^habit-hooks v0\.0\.0$/);
  });

  describe('malformed config', () => {
    let workDir: string;

    beforeEach(() => {
      workDir = mkdtempSync(join(tmpdir(), 'hh-cli-bad-'));
    });

    afterEach(() => {
      rmSync(workDir, { recursive: true, force: true });
    });

    it('exits 2 and prints a field-path message on malformed config', () => {
      const bad = { rules: { x: { severity: 'bogus' } } };
      writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
      const result = spawnSync('node', [cliPath], { cwd: workDir, encoding: 'utf8' });
      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/rules\.x\.severity must be 'enforced' or 'suggested'/);
    });
  });

  describe('--config flag', () => {
    it('applies the config at the given path from a different cwd', () => {
      const configPath = join(fixturesDir, 'configured-project', 'habit-hooks.config.ts');
      const dirtyCwd = join(fixturesDir, 'dirty-project');
      const result = spawnSync('node', [cliPath, '--config', configPath], {
        cwd: dirtyCwd,
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('Habit Hooks: 1 violation');
      expect(result.stdout).toContain('Too many parameters');
      expect(result.stdout).toContain('CUSTOM PROJECT GUIDANCE');
    });
  });
});
