import { gitExec, GitError } from '../git/exec.js';

export function lastCommitHash(cwd: string, relPath: string): string | null {
  try {
    const out = gitExec(['log', '-n', '1', '--format=%H', '--', relPath], cwd);
    const hash = out.trim();
    return hash.length === 0 ? null : hash;
  } catch (err) {
    if (err instanceof GitError) return null;
    throw err;
  }
}

export function isWorkingTreeCleanFor(cwd: string, relPath: string): boolean {
  try {
    const out = gitExec(['status', '--porcelain', '--', relPath], cwd);
    return out.trim().length === 0;
  } catch (err) {
    if (err instanceof GitError) return false;
    throw err;
  }
}
