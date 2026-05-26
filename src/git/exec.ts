import { execFileSync } from 'node:child_process';

export class GitError extends Error {
  constructor(
    public readonly command: string,
    public readonly stderr: string,
    public readonly cause?: unknown,
  ) {
    super(`git ${command} failed: ${stderr.trim() || (cause instanceof Error ? cause.message : '')}`);
    this.name = 'GitError';
  }
}

function readStderr(err: unknown): string {
  if (err && typeof err === 'object' && 'stderr' in err) {
    const stderr = (err as { stderr: unknown }).stderr;
    if (typeof stderr === 'string') return stderr;
    if (stderr instanceof Buffer) return stderr.toString('utf8');
  }
  return '';
}

export function gitExec(args: string[], cwd: string): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    throw new GitError(args.join(' '), readStderr(err), err);
  }
}

export function isGitRepo(cwd: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}
