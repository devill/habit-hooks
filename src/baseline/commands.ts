import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { run } from '../runner.js';
import { isWorkingTreeCleanFor, lastCommitHash } from './file-hash.js';
import {
  baselineExists,
  loadBaseline,
  saveBaseline,
  type BaselineEntry,
  type BaselineFile,
} from './store.js';
import { toRepoRelative } from './filter.js';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function ok(stdout = ''): CommandResult {
  return { stdout, stderr: '', exitCode: 0 };
}

function err(stderr: string, exitCode = 2): CommandResult {
  return { stdout: '', stderr, exitCode };
}

function uniqueRelPaths(cwd: string, paths: string[]): string[] {
  const seen = new Set<string>();
  for (const p of paths) seen.add(toRepoRelative(cwd, join(cwd, p)));
  return [...seen];
}

async function collectViolatingFiles(cwd: string): Promise<string[]> {
  const result = await run(cwd, {
    scopeFlags: { all: true },
    applyBaseline: false,
  });
  const out = new Set<string>();
  for (const violation of result.violations) {
    out.add(toRepoRelative(cwd, violation.file));
  }
  return [...out];
}

export async function baselineGenerate(cwd: string): Promise<CommandResult> {
  const violatingFiles = await collectViolatingFiles(cwd);
  const baseline = loadBaseline(cwd);
  const files = { ...baseline.files };
  let added = 0;
  for (const relPath of violatingFiles) {
    const hash = lastCommitHash(cwd, relPath);
    if (hash === null) continue;
    files[relPath] = { snoozedAt: hash };
    added += 1;
  }
  saveBaseline(cwd, { version: 1, files });
  return ok(`baseline generate: recorded ${String(added)} file(s)\n`);
}

interface SnoozeBatch {
  errors: string[];
  updates: Record<string, BaselineEntry>;
}

function buildSnoozeBatch(cwd: string, targets: string[]): SnoozeBatch {
  const errors: string[] = [];
  const updates: Record<string, BaselineEntry> = {};
  for (const rel of targets) {
    const validation = validateSnoozeTarget(cwd, rel);
    if (validation.error !== null) errors.push(validation.error);
    else updates[rel] = { snoozedAt: validation.hash };
  }
  return { errors, updates };
}

export function baselineSnooze(cwd: string, paths: string[]): CommandResult {
  const baseline = loadBaseline(cwd);
  const targets = uniqueRelPaths(cwd, paths);
  const { errors, updates } = buildSnoozeBatch(cwd, targets);
  if (errors.length > 0) return err(`${errors.join('\n')}\n`);
  saveBaseline(cwd, { version: 1, files: { ...baseline.files, ...updates } });
  return ok(`baseline snooze: added ${String(Object.keys(updates).length)} file(s)\n`);
}

interface SnoozeValidation {
  error: string | null;
  hash: string;
}

function validateSnoozeTarget(cwd: string, relPath: string): SnoozeValidation {
  const absPath = join(cwd, relPath);
  if (!existsSync(absPath)) {
    return { error: `cannot snooze '${relPath}': file does not exist`, hash: '' };
  }
  const hash = lastCommitHash(cwd, relPath);
  if (hash === null) {
    return {
      error: `cannot snooze '${relPath}': file is untracked (commit it first)`,
      hash: '',
    };
  }
  return { error: null, hash };
}

export function baselineForget(cwd: string, paths: string[]): CommandResult {
  const baseline = loadBaseline(cwd);
  const targets = uniqueRelPaths(cwd, paths);
  const files = { ...baseline.files };
  let removed = 0;
  for (const rel of targets) {
    if (rel in files) {
      delete files[rel];
      removed += 1;
    }
  }
  if (removed > 0) saveBaseline(cwd, { version: 1, files });
  return ok(`baseline forget: removed ${String(removed)} entry/entries\n`);
}

function shouldKeepEntry(cwd: string, relPath: string, violating: Set<string>): boolean {
  if (!existsSync(join(cwd, relPath))) return false;
  return violating.has(relPath);
}

export async function baselinePrune(cwd: string): Promise<CommandResult> {
  const baseline = loadBaseline(cwd);
  const violatingFiles = await collectViolatingFiles(cwd);
  const violating = new Set(violatingFiles);
  const files: Record<string, BaselineEntry> = {};
  let removed = 0;
  for (const [rel, entry] of Object.entries(baseline.files)) {
    if (shouldKeepEntry(cwd, rel, violating)) files[rel] = entry;
    else removed += 1;
  }
  saveBaseline(cwd, { version: 1, files });
  return ok(`baseline prune: removed ${String(removed)} entry/entries\n`);
}

type EntryState = 'current' | 'stale-changed' | 'stale-missing';

function classifyEntry(cwd: string, relPath: string, entry: BaselineEntry): EntryState {
  if (!existsSync(join(cwd, relPath))) return 'stale-missing';
  const hash = lastCommitHash(cwd, relPath);
  if (hash === null) return 'stale-missing';
  if (hash !== entry.snoozedAt) return 'stale-changed';
  if (!isWorkingTreeCleanFor(cwd, relPath)) return 'stale-changed';
  return 'current';
}

function renderStatusLines(cwd: string, entries: [string, BaselineEntry][]): string[] {
  const lines = [`Baseline: ${String(entries.length)} snoozed file(s)`];
  for (const [rel, entry] of entries) {
    lines.push(`  [${classifyEntry(cwd, rel, entry)}] ${rel}`);
  }
  return lines;
}

export function baselineStatus(cwd: string): CommandResult {
  if (!baselineExists(cwd)) return ok('No baseline file found.\n');
  const entries = Object.entries(loadBaseline(cwd).files).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return ok('Baseline file is empty.\n');
  return ok(`${renderStatusLines(cwd, entries).join('\n')}\n`);
}

export type { BaselineFile };
