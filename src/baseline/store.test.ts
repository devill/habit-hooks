import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createGitRepo, type GitRepo } from '../../tests/helpers/git.js';
import {
  BASELINE_FILENAME,
  BaselineVersionError,
  loadBaseline,
  saveBaseline,
} from './store.js';

describe('baseline store', () => {
  let repo: GitRepo;

  afterEach(() => {
    if (repo) rmSync(repo.cwd, { recursive: true, force: true });
  });

  it('returns empty baseline when file is missing', () => {
    repo = createGitRepo();
    const baseline = loadBaseline(repo.cwd);
    expect(baseline).toEqual({ version: 1, files: {} });
  });

  it('round-trips through save and load', () => {
    repo = createGitRepo();
    const original = {
      version: 1 as const,
      files: {
        'src/a.ts': { snoozedAt: 'aaa' },
        'src/b.ts': { snoozedAt: 'bbb' },
      },
    };
    saveBaseline(repo.cwd, original);
    const loaded = loadBaseline(repo.cwd);
    expect(loaded).toEqual(original);
  });

  it('writes a stable, sorted, pretty-printed file ending with newline', () => {
    repo = createGitRepo();
    const baseline = {
      version: 1 as const,
      files: {
        'z.ts': { snoozedAt: 'zhash' },
        'a.ts': { snoozedAt: 'ahash' },
        'm.ts': { snoozedAt: 'mhash' },
      },
    };
    saveBaseline(repo.cwd, baseline);
    const contents = readFileSync(join(repo.cwd, BASELINE_FILENAME), 'utf8');
    expect(contents.endsWith('\n')).toBe(true);
    const aIndex = contents.indexOf('"a.ts"');
    const mIndex = contents.indexOf('"m.ts"');
    const zIndex = contents.indexOf('"z.ts"');
    expect(aIndex).toBeLessThan(mIndex);
    expect(mIndex).toBeLessThan(zIndex);
  });

  it('produces byte-identical output across two saves of the same data', () => {
    repo = createGitRepo();
    const baseline = {
      version: 1 as const,
      files: { 'b.ts': { snoozedAt: 'bbb' }, 'a.ts': { snoozedAt: 'aaa' } },
    };
    saveBaseline(repo.cwd, baseline);
    const first = readFileSync(join(repo.cwd, BASELINE_FILENAME), 'utf8');
    saveBaseline(repo.cwd, baseline);
    const second = readFileSync(join(repo.cwd, BASELINE_FILENAME), 'utf8');
    expect(second).toBe(first);
  });

  it('throws BaselineVersionError on unsupported version', () => {
    repo = createGitRepo();
    repo.writeFile(BASELINE_FILENAME, JSON.stringify({ version: 2, files: {} }));
    expect(() => loadBaseline(repo.cwd)).toThrow(BaselineVersionError);
    expect(() => loadBaseline(repo.cwd)).toThrow(/unsupported baseline version 2; expected 1/);
  });
});
