import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { guide } from './guide.js';
import type { GuideAction, MapResult } from '../mapper/mapper.js';
import type { Issue } from '../sensors/types.js';

function issue(smell: string, file: string, line = 1): Issue {
  return { smell, details: { file, line, message: `issue at ${line}` } };
}

interface ActionSpec {
  smell: string;
  severity: 'enforced' | 'suggested';
  path: string;
  issues: Issue[];
}

function promptAction(spec: ActionSpec): GuideAction {
  return { smell: spec.smell, severity: spec.severity, issues: spec.issues, action: { kind: 'prompt', templatePath: spec.path } };
}

describe('guide', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hh-guide-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function template(name: string, body: string): string {
    const path = join(dir, name);
    writeFileSync(path, body);
    return path;
  }

  function run(result: MapResult): { stdout: string; exitCode: number } {
    return guide({ result, searchPaths: [dir] });
  }

  it('prints the clean banner and exit 0 when there is nothing to coach', () => {
    const out = run({ actions: [], uncoached: [] });
    expect(out.exitCode).toBe(0);
    expect(out.stdout).toContain('automated checks passed.');
    expect(out.stdout).toContain('reviewer sub-agent');
  });

  it('renders a prompt template against its smell and issues', () => {
    const path = template('too-many-parameters.md', '## {{ smell }}\n{{ issues | length }} issue(s)');
    const action = promptAction({
      smell: 'too-many-parameters',
      severity: 'enforced',
      path,
      issues: [issue('too-many-parameters', '/a.ts')],
    });

    const out = run({ actions: [action], uncoached: [] });

    expect(out.stdout).toContain('## too-many-parameters');
    expect(out.stdout).toContain('1 issue(s)');
    expect(out.stdout).toContain('Habit Hooks: 1 violation');
    expect(out.exitCode).toBe(1);
  });

  it('exits 0 when only suggested smells fired', () => {
    const path = template('warning-comment.md', '{{ issues | length }}');
    const action = promptAction({
      smell: 'warning-comment',
      severity: 'suggested',
      path,
      issues: [issue('warning-comment', '/a.ts', 2)],
    });
    expect(run({ actions: [action], uncoached: [] }).exitCode).toBe(0);
  });

  it('groups a smell over multiple issues by file (per-smell grouping)', () => {
    const body = [
      '## {{ smell }} ({{ issues | length }})',
      '{% for file, group in issues | groupby("details.file") %}',
      '{{ file }}: {{ group | length }}',
      '{% endfor %}',
    ].join('\n');
    const path = template('oversized-function.md', body);
    const issues = [
      issue('oversized-function', '/a.ts', 1),
      issue('oversized-function', '/a.ts', 9),
      issue('oversized-function', '/b.ts', 1),
    ];
    const action = promptAction({ smell: 'oversized-function', severity: 'enforced', path, issues });

    const out = run({ actions: [action], uncoached: [] });

    expect(out.stdout).toContain('## oversized-function (3)');
    expect(out.stdout).toContain('/a.ts: 2');
    expect(out.stdout).toContain('/b.ts: 1');
  });

  it('lists the uncoached bucket with provenance and does not escalate the exit code', () => {
    const uncoached: Issue[] = [
      { smell: 'no-console', details: { file: '/a.ts', line: 3, message: 'x', source: 'eslint:no-console' } },
    ];
    const out = run({ actions: [], uncoached });
    expect(out.stdout).toContain('Uncoached smells');
    expect(out.stdout).toContain('eslint:no-console');
    expect(out.stdout).toContain('/a.ts:3');
    expect(out.exitCode).toBe(0);
  });
});
