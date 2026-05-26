import { relative, sep } from 'node:path';
import { isWorkingTreeCleanFor, lastCommitHash } from './file-hash.js';
import type { BaselineFile } from './store.js';

export function toRepoRelative(cwd: string, absPath: string): string {
  return relative(cwd, absPath).split(sep).join('/');
}

function isSnoozed(relPath: string, baseline: BaselineFile, cwd: string): boolean {
  const entry = baseline.files[relPath];
  if (entry === undefined) return false;
  const currentHash = lastCommitHash(cwd, relPath);
  if (currentHash === null) return false;
  if (currentHash !== entry.snoozedAt) return false;
  return isWorkingTreeCleanFor(cwd, relPath);
}

export interface SnoozePartition {
  active: string[];
  skipped: string[];
}

export function partitionBySnooze(
  files: string[],
  baseline: BaselineFile,
  cwd: string,
): SnoozePartition {
  const active: string[] = [];
  const skipped: string[] = [];
  for (const abs of files) {
    const rel = toRepoRelative(cwd, abs);
    if (isSnoozed(rel, baseline, cwd)) skipped.push(abs);
    else active.push(abs);
  }
  return { active, skipped };
}
