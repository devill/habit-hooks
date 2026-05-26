import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

export interface GitRepo {
  cwd: string;
  writeFile: (relPath: string, contents: string) => void;
  commitAll: (message: string) => void;
  run: (args: string[]) => string;
}

function gitInit(cwd: string): void {
  execFileSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
}

function makeWriteFile(cwd: string): GitRepo['writeFile'] {
  return (relPath, contents) => {
    const full = join(cwd, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  };
}

function makeCommitAll(cwd: string): GitRepo['commitAll'] {
  return (message) => {
    execFileSync('git', ['add', '-A'], { cwd });
    execFileSync('git', ['commit', '--quiet', '-m', message], { cwd });
  };
}

function makeRun(cwd: string): GitRepo['run'] {
  return (args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
}

export function createGitRepo(): GitRepo {
  const cwd = mkdtempSync(join(tmpdir(), 'hh-git-'));
  gitInit(cwd);
  return {
    cwd,
    writeFile: makeWriteFile(cwd),
    commitAll: makeCommitAll(cwd),
    run: makeRun(cwd),
  };
}
