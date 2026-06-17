import { closeSync, constants, fchmodSync, openSync, readFileSync, writeSync } from 'node:fs';

// File writes that follow symlinks let a malicious working tree redirect them
// outside the project root. A dangling symlink at the target (target absent)
// slips past an `existsSync` guard, and the write then lands wherever the link
// points — including, for the git hook, an executable. Opening with O_NOFOLLOW
// makes the open fail (ELOOP) when the final path component is a symlink, which
// closes the hole without a TOCTOU window.

export class SymlinkWriteError extends Error {
  constructor(path: string) {
    super(`refusing to write through symlink: ${path}`);
    this.name = 'SymlinkWriteError';
  }
}

interface SafeWriteOptions {
  mode?: number; // applied to the opened fd (does not follow the link)
}

const NOFOLLOW_WRITE = constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW;

function openNoFollow(path: string): number {
  try {
    return openSync(path, NOFOLLOW_WRITE, 0o666);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ELOOP') throw new SymlinkWriteError(path);
    throw err;
  }
}

export function safeWriteFileSync(path: string, data: string, options: SafeWriteOptions = {}): void {
  const fd = openNoFollow(path);
  try {
    writeSync(fd, data);
    if (options.mode !== undefined) fchmodSync(fd, options.mode);
  } finally {
    closeSync(fd);
  }
}

export function safeCopyFileSync(source: string, target: string, options: SafeWriteOptions = {}): void {
  safeWriteFileSync(target, readFileSync(source, 'utf8'), options);
}
