import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { createGitRepo, type GitRepo } from '../../tests/helpers/git.js';
import { isWorkingTreeCleanFor, lastCommitHash } from './file-hash.js';

describe('lastCommitHash', () => {
  let repo: GitRepo;

  afterEach(() => {
    if (repo) rmSync(repo.cwd, { recursive: true, force: true });
  });

  it('returns the last commit hash for a tracked file', () => {
    repo = createGitRepo();
    repo.writeFile('a.ts', 'export const a = 1;\n');
    repo.commitAll('first');
    const hash = lastCommitHash(repo.cwd, 'a.ts');
    expect(hash).not.toBeNull();
    expect(hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it('updates when the file is committed again', () => {
    repo = createGitRepo();
    repo.writeFile('a.ts', 'export const a = 1;\n');
    repo.commitAll('first');
    const first = lastCommitHash(repo.cwd, 'a.ts');
    repo.writeFile('a.ts', 'export const a = 2;\n');
    repo.commitAll('second');
    const second = lastCommitHash(repo.cwd, 'a.ts');
    expect(second).not.toBe(first);
  });

  it('returns null for untracked files', () => {
    repo = createGitRepo();
    repo.writeFile('untracked.ts', 'export const x = 1;\n');
    expect(lastCommitHash(repo.cwd, 'untracked.ts')).toBeNull();
  });

  it('returns null for a path that does not exist in history', () => {
    repo = createGitRepo();
    repo.writeFile('a.ts', 'export const a = 1;\n');
    repo.commitAll('first');
    expect(lastCommitHash(repo.cwd, 'ghost.ts')).toBeNull();
  });
});

describe('isWorkingTreeCleanFor', () => {
  let repo: GitRepo;

  afterEach(() => {
    if (repo) rmSync(repo.cwd, { recursive: true, force: true });
  });

  it('returns true for a tracked, unmodified file', () => {
    repo = createGitRepo();
    repo.writeFile('a.ts', 'export const a = 1;\n');
    repo.commitAll('first');
    expect(isWorkingTreeCleanFor(repo.cwd, 'a.ts')).toBe(true);
  });

  it('returns false for a tracked file with unstaged modifications', () => {
    repo = createGitRepo();
    repo.writeFile('a.ts', 'export const a = 1;\n');
    repo.commitAll('first');
    repo.writeFile('a.ts', 'export const a = 2;\n');
    expect(isWorkingTreeCleanFor(repo.cwd, 'a.ts')).toBe(false);
  });

  it('returns false for an untracked file', () => {
    repo = createGitRepo();
    repo.writeFile('a.ts', 'export const a = 1;\n');
    expect(isWorkingTreeCleanFor(repo.cwd, 'a.ts')).toBe(false);
  });
});
