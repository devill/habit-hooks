import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeWriteFileSync, SymlinkWriteError } from './safe-fs.js';

describe('safeWriteFileSync', () => {
  let dir: string;
  let outside: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hh-safefs-'));
    outside = mkdtempSync(join(tmpdir(), 'hh-outside-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it('writes a regular file and applies the requested mode', () => {
    const path = join(dir, 'hook');
    safeWriteFileSync(path, 'body', { mode: 0o755 });
    expect(readFileSync(path, 'utf8')).toBe('body');
    expect(statSync(path).mode & 0o777).toBe(0o755);
  });

  it('refuses to write through a dangling symlink (no escape outside the dir)', () => {
    const target = join(outside, 'planted');
    symlinkSync(target, join(dir, 'config'));

    expect(() => safeWriteFileSync(join(dir, 'config'), 'x')).toThrow(SymlinkWriteError);
    expect(existsSync(target)).toBe(false);
  });

  it('refuses to write through a symlink to an existing outside file', () => {
    const target = join(outside, 'real');
    safeWriteFileSync(target, 'original');
    symlinkSync(target, join(dir, 'config'));

    expect(() => safeWriteFileSync(join(dir, 'config'), 'tampered')).toThrow(SymlinkWriteError);
    expect(readFileSync(target, 'utf8')).toBe('original');
    expect(lstatSync(join(dir, 'config')).isSymbolicLink()).toBe(true);
  });
});
