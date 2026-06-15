import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTool } from '../wrap/shell.js';
import { isSpawnFailure } from '../wrap/notices.js';
import { extractIssues, type AdapterSpec } from './adapter.js';
import type { Issue, Sensor } from './types.js';

// deptry analyses the whole project and reports unused dependencies. Its
// `--json-output` must target a real file (writing to /dev/stdout yields nothing
// when stdout is a pipe), so deptry uses the temp-report pattern rather than the
// stdout declarative adapter — but reuses the adapter's extractIssues to map.
const DEPTRY_SPEC: AdapterSpec = {
  id: 'deptry',
  command: 'deptry . --json-output <report>',
  items: '[]',
  fields: { smell: 'error.code', file: 'location.file', line: 'location.line', message: 'error.message' },
  map: { DEP002: 'unused-dependency' },
};

function parseReport(path: string): Issue[] {
  if (!existsSync(path)) return [];
  try {
    return extractIssues(JSON.parse(readFileSync(path, 'utf8')), DEPTRY_SPEC);
  } catch {
    return [];
  }
}

async function runReport(cwd: string, out: string, notices: string[]): Promise<boolean> {
  const result = await runTool({ bin: 'deptry', args: ['.', '--json-output', out], cwd });
  if (isSpawnFailure(result)) {
    notices.push(`habit-hooks: deptry skipped in ${cwd} (${result.warnings[0] ?? 'spawn failure'})`);
    return false;
  }
  return true;
}

async function runDeptry(cwd: string, notices: string[]): Promise<Issue[]> {
  const dir = mkdtempSync(join(tmpdir(), 'hh-deptry-'));
  try {
    const out = join(dir, 'deptry.json');
    return (await runReport(cwd, out, notices)) ? parseReport(out) : [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function deptrySensor(notices: string[]): Sensor {
  return { id: 'deptry', produces: ['unused-dependency'], run: (ctx) => runDeptry(ctx.cwd, notices) };
}
