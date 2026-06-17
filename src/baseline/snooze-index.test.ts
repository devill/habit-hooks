import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gitExec, GitError } from '../git/exec.js';
import { createSnoozeIndex } from './snooze-index.js';
import type { BaselineFile } from './store.js';

vi.mock('../git/exec.js', () => ({
  gitExec: vi.fn(),
  GitError: class GitError extends Error {},
}));

const mockGit = vi.mocked(gitExec);

function baselineWith(files: Record<string, string>): BaselineFile {
  const out: BaselineFile['files'] = {};
  for (const [path, hash] of Object.entries(files)) out[path] = { snoozedAtCommit: hash };
  return { version: 2, files: out };
}

describe('createSnoozeIndex', () => {
  beforeEach(() => {
    mockGit.mockReset();
  });

  function callCounts(): { status: number; log: number } {
    const calls = mockGit.mock.calls.map((c) => c[0][0]);
    return {
      status: calls.filter((arg) => arg === 'status').length,
      log: calls.filter((arg) => arg === 'log').length,
    };
  }

  it('runs one whole-tree status and memoizes log across many isSnoozed calls', () => {
    mockGit.mockImplementation((args) => (args[0] === 'log' ? 'abc123\n' : ''));
    const baseline = baselineWith({ 'a.ts': 'abc123', 'b.ts': 'abc123' });
    const index = createSnoozeIndex('/repo');

    for (let rule = 0; rule < 9; rule += 1) {
      index.isSnoozed('/repo/a.ts', baseline);
      index.isSnoozed('/repo/b.ts', baseline);
    }

    const counts = callCounts();
    expect(counts.status).toBe(1);
    expect(counts.log).toBe(2);
  });

  it('treats a file listed by git status as dirty (not snoozed)', () => {
    mockGit.mockImplementation((args) => {
      if (args[0] === 'log') return 'abc123\n';
      return ' M a.ts\0';
    });
    const index = createSnoozeIndex('/repo');
    expect(index.isSnoozed('/repo/a.ts', baselineWith({ 'a.ts': 'abc123' }))).toBe(false);
  });

  it('treats both sides of a rename as dirty', () => {
    mockGit.mockImplementation((args) => {
      if (args[0] === 'log') return 'abc123\n';
      return 'R  new.ts\0old.ts\0';
    });
    const index = createSnoozeIndex('/repo');
    expect(index.isSnoozed('/repo/old.ts', baselineWith({ 'old.ts': 'abc123' }))).toBe(false);
  });

  it('treats both sides of a copy as dirty', () => {
    mockGit.mockImplementation((args) => {
      if (args[0] === 'log') return 'abc123\n';
      return 'C  copy.ts\0source.ts\0';
    });
    const index = createSnoozeIndex('/repo');
    expect(index.isSnoozed('/repo/source.ts', baselineWith({ 'source.ts': 'abc123' }))).toBe(false);
  });

  // Porcelain v1 only puts R/C in the X (first) column. A record whose X column is
  // not R/C but whose Y column is (e.g. ' C') must NOT consume the next record as a
  // rename/copy origin — that next record is an independent file's status. The old
  // `record.slice(0, 2)` check matched the Y column and mis-paired the records.
  it('does not consume the following record when only the Y column is R/C', () => {
    mockGit.mockImplementation((args) => {
      if (args[0] === 'log') return 'abc123\n';
      return ' C first.ts\0 M second.ts\0';
    });
    const index = createSnoozeIndex('/repo');
    expect(index.isSnoozed('/repo/second.ts', baselineWith({ 'second.ts': 'abc123' }))).toBe(false);
  });

  it('treats every file as dirty (not snoozed) when git status fails', () => {
    mockGit.mockImplementation((args) => {
      if (args[0] === 'log') return 'abc123\n';
      throw new GitError('git status failed');
    });
    const index = createSnoozeIndex('/repo');
    expect(index.isSnoozed('/repo/a.ts', baselineWith({ 'a.ts': 'abc123' }))).toBe(false);
  });

  it('is not snoozed when the entry hash no longer matches HEAD', () => {
    mockGit.mockImplementation((args) => (args[0] === 'log' ? 'newhash\n' : ''));
    const index = createSnoozeIndex('/repo');
    expect(index.isSnoozed('/repo/a.ts', baselineWith({ 'a.ts': 'oldhash' }))).toBe(false);
  });
});
