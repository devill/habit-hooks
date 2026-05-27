import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { knipWrap } from './knip-wrap.js';
import type { CheckOutcome, Rule } from '../types.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const repoNodeModules = join(repoRoot, 'node_modules');

const RULES: Rule[] = [];

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'hh-knip-wrap-'));
}

function linkNodeModules(cwd: string): void {
  symlinkSync(repoNodeModules, join(cwd, 'node_modules'), 'dir');
}

function writeFile(cwd: string, rel: string, contents: string): string {
  const full = join(cwd, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
  return full;
}

function writeKnipProject(cwd: string): { main: string; foo: string } {
  writeFile(cwd, 'package.json', JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }));
  writeFile(cwd, 'knip.json', JSON.stringify({ entry: ['src/main.ts'], project: ['src/**/*.ts'] }));
  const main = writeFile(
    cwd,
    'src/main.ts',
    "import { Foo } from './foo.ts';\nconst foo = new Foo();\nconsole.log(foo.used());\n",
  );
  const foo = writeFile(
    cwd,
    'src/foo.ts',
    'export class Foo {\n  used(): number {\n    return 1;\n  }\n  unused(): number {\n    return 2;\n  }\n}\n',
  );
  return { main, foo };
}

function asOutcome(result: Awaited<ReturnType<typeof knipWrap.run>>): CheckOutcome {
  if (Array.isArray(result)) return { violations: result, stderr: [] };
  return result;
}

async function runWrap(cwd: string, files: string[]): Promise<CheckOutcome> {
  return asOutcome(await knipWrap.run(files, RULES, cwd));
}

describe('knipWrap', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = makeTempDir();
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('returns knip-prefixed violations when consumer knip reports issues', async () => {
    linkNodeModules(cwd);
    const { main, foo } = writeKnipProject(cwd);

    const outcome = await runWrap(cwd, [main, foo]);

    expect(outcome.violations.some((v) => v.ruleId === 'knip:classMembers' && v.file === foo)).toBe(true);
    expect(outcome.stderr).toEqual([]);
  }, 30_000);

  it('emits a single fallback stderr notice when no consumer knip is installed', async () => {
    const { main, foo } = writeKnipProject(cwd);

    const outcome = await runWrap(cwd, [main, foo]);

    expect(outcome.stderr?.[0]).toContain('using bundled knip');
    expect(outcome.violations.length).toBeGreaterThan(0);
  }, 30_000);

  it('warns and returns no violations when no package.json is present', async () => {
    linkNodeModules(cwd);
    const file = writeFile(cwd, 'src/a.ts', 'export const a = 1;\n');

    const outcome = await runWrap(cwd, [file]);

    expect(outcome.violations).toEqual([]);
    expect(outcome.stderr?.some((s) => s.includes('no package.json'))).toBe(true);
  });

  it('runs whole-project when any files are given and reports all violations', async () => {
    linkNodeModules(cwd);
    const { main } = writeKnipProject(cwd);

    const outcome = await runWrap(cwd, [main]);

    expect(outcome.violations.some((v) => v.ruleId === 'knip:classMembers')).toBe(true);
  }, 30_000);

  it('skips invocation entirely when file list is empty', async () => {
    linkNodeModules(cwd);
    writeKnipProject(cwd);

    const outcome = await runWrap(cwd, []);

    expect(outcome).toEqual({ violations: [], stderr: [] });
  });

  it('emits a knip:files violation for top-level report.files entries', async () => {
    linkNodeModules(cwd);
    writeFile(cwd, 'package.json', JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }));
    writeFile(cwd, 'knip.json', JSON.stringify({ entry: ['src/main.ts'], project: ['src/**/*.ts'] }));
    const main = writeFile(cwd, 'src/main.ts', "console.log('hi');\n");
    const orphan = writeFile(cwd, 'src/orphan.ts', 'export const orphan = 1;\n');

    const outcome = await runWrap(cwd, [main, orphan]);

    const filesViolation = outcome.violations.find((v) => v.ruleId === 'knip:files');
    expect(filesViolation).toBeDefined();
    expect(filesViolation?.file).toBe(orphan);
  }, 30_000);

  it('silently ignores unknown issue keys (forward-compat with new knip issue types)', async () => {
    const knipDir = join(cwd, 'node_modules', 'knip');
    mkdirSync(knipDir, { recursive: true });
    const payload = {
      files: [],
      issues: [{ file: 'src/a.ts', unlistedPeerDependencies: [{ name: 'left-pad', line: 3 }] }],
    };
    const stub = writeFile(
      cwd,
      'node_modules/knip/stub.js',
      `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(JSON.stringify(payload))});\nprocess.exit(0);\n`,
    );
    chmodSync(stub, 0o755);
    writeFileSync(join(knipDir, 'package.json'), JSON.stringify({ bin: { knip: 'stub.js' } }));
    writeFile(cwd, 'package.json', JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }));
    writeFile(cwd, 'knip.json', JSON.stringify({ entry: ['src/a.ts'], project: ['src/**/*.ts'] }));
    const file = writeFile(cwd, 'src/a.ts', 'export const a = 1;\n');

    const outcome = await runWrap(cwd, [file]);

    expect(outcome.violations).toEqual([]);
    expect(outcome.stderr).toEqual([]);
  });

  it('emits a spawn-failure stderr notice when the knip binary cannot be executed', async () => {
    const knipDir = join(cwd, 'node_modules', 'knip');
    mkdirSync(knipDir, { recursive: true });
    const fakeBin = writeFile(cwd, 'node_modules/knip/knip-broken', 'not-executable');
    chmodSync(fakeBin, 0o644);
    writeFileSync(join(knipDir, 'package.json'), JSON.stringify({ bin: { knip: 'knip-broken' } }));
    writeFile(cwd, 'package.json', JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }));
    writeFile(cwd, 'knip.json', JSON.stringify({ entry: ['src/a.ts'], project: ['src/**/*.ts'] }));
    const file = writeFile(cwd, 'src/a.ts', 'export const a = 1;\n');

    const outcome = await runWrap(cwd, [file]);

    expect(outcome.violations).toEqual([]);
    expect(outcome.stderr?.some((s) => s.includes('knip skipped') && /EACCES|spawn/i.test(s))).toBe(true);
  });

  it('emits a skip stderr notice when no knip config file exists', async () => {
    linkNodeModules(cwd);
    writeFile(cwd, 'package.json', JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }));
    const file = writeFile(cwd, 'src/a.ts', 'export const a = 1;\n');

    const outcome = await runWrap(cwd, [file]);

    expect(outcome.violations).toEqual([]);
    expect(outcome.stderr?.some((s) => s.includes('no knip config'))).toBe(true);
  });

  it('runs when knip config is supplied via package.json#knip', async () => {
    linkNodeModules(cwd);
    const pkg = {
      name: 'fixture',
      version: '0.0.0',
      type: 'module',
      knip: { entry: ['src/main.ts'], project: ['src/**/*.ts'] },
    };
    writeFile(cwd, 'package.json', JSON.stringify(pkg));
    const main = writeFile(
      cwd,
      'src/main.ts',
      "import { Foo } from './foo.ts';\nconst foo = new Foo();\nconsole.log(foo.used());\n",
    );
    const foo = writeFile(
      cwd,
      'src/foo.ts',
      'export class Foo {\n  used(): number {\n    return 1;\n  }\n  unused(): number {\n    return 2;\n  }\n}\n',
    );

    const outcome = await runWrap(cwd, [main, foo]);

    expect(outcome.violations.some((v) => v.ruleId === 'knip:classMembers')).toBe(true);
  }, 30_000);
});
