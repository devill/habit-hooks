import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { JSCPD_RECOMMENDED } from './recommendations.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from './run.js';
import { makeAutoPrompter } from './prompts.js';
import type { CommandRunner, CommandResult } from './command-runner.js';
import type { Language } from '../../config/schema.js';

interface RecordingRunner {
  commands: string[];
  runCommand: CommandRunner;
}

function recordingRunner(result: CommandResult = { ok: true, output: '' }): RecordingRunner {
  const commands: string[] = [];
  const runCommand: CommandRunner = (command) => {
    commands.push(command);
    return Promise.resolve(result);
  };
  return { commands, runCommand };
}

function runAccept(
  cwd: string,
  language: Language,
  runner: RecordingRunner,
): ReturnType<typeof runInit> {
  return runInit(cwd, {
    prompter: makeAutoPrompter(false),
    language,
    acceptRecommendations: true,
    runCommand: runner.runCommand,
  });
}

describe('apply-recommendations (--accept-recommendations)', () => {
  let cwd: string;
  let home: string;
  let originalHome: string | undefined;
  let originalPath: string | undefined;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'hh-accept-'));
    home = mkdtempSync(join(tmpdir(), 'hh-accept-home-'));
    originalHome = process.env.HOME;
    originalPath = process.env.PATH;
    process.env.HOME = home;
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo' }));
  });
  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.PATH = originalPath;
    rmSync(cwd, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  function pythonToolsOnPath(): string {
    const bin = mkdtempSync(join(tmpdir(), 'hh-accept-bin-'));
    for (const tool of ['ruff', 'deptry']) writeFileSync(join(bin, tool), '#!/bin/sh\n');
    return bin;
  }

  function fakeJscpdInstalled(): void {
    const binDir = join(cwd, 'node_modules', '.bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, 'jscpd'), '#!/usr/bin/env node\n');
    const pkgDir = join(cwd, 'node_modules', 'jscpd');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'jscpd' }));
  }

  it('writes no header and records no commands when nothing is applicable', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    const complete = Object.fromEntries(JSCPD_RECOMMENDED.map((k) => [k.key, k.value]));
    writeFileSync(join(cwd, '.jscpd.json'), JSON.stringify(complete));
    fakeJscpdInstalled();
    process.env.PATH = pythonToolsOnPath();
    const runner = recordingRunner();
    const result = await runAccept(cwd, 'python', runner);
    expect(result.exitCode).toBe(0);
    expect(runner.commands).toEqual([]);
    expect(result.stdout).not.toContain('Applying recommendations:');
  });

  it('never invokes the runner when the flag is absent', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    process.env.PATH = pythonToolsOnPath();
    const runner = recordingRunner();
    const result = await runInit(cwd, {
      prompter: makeAutoPrompter(false),
      language: 'python',
      runCommand: runner.runCommand,
    });
    expect(runner.commands).toEqual([]);
    expect(result.stdout).not.toContain('Applying recommendations:');
  });

  it('runs the node install command for a missing jscpd via the injected runner', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    process.env.PATH = pythonToolsOnPath();
    const runner = recordingRunner();
    const result = await runAccept(cwd, 'python', runner);
    expect(result.exitCode).toBe(0);
    expect(runner.commands).toEqual(['npm install --save-dev jscpd']);
    expect(result.stdout).toContain('Applying recommendations:');
    expect(result.stdout).toContain('Running: npm install --save-dev jscpd');
    expect(result.stdout).toContain('✓ installed');
  });

  it('runs both pip and node install commands when all tools are missing', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    process.env.PATH = '';
    const runner = recordingRunner();
    await runAccept(cwd, 'python', runner);
    expect(runner.commands).toContain('npm install --save-dev jscpd');
    expect(runner.commands).toContain('pip install ruff deptry');
  });

  it('reports a failed install without throwing and keeps exit code 0', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    process.env.PATH = pythonToolsOnPath();
    const runner = recordingRunner({ ok: false, output: 'boom' });
    const result = await runAccept(cwd, 'python', runner);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✗ failed: boom');
  });

  it('additively merges missing recommended keys into an existing .jscpd.json', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    writeFileSync(join(cwd, '.jscpd.json'), JSON.stringify({ minLines: 3 }));
    process.env.PATH = pythonToolsOnPath();
    const result = await runAccept(cwd, 'python', recordingRunner());
    const raw = readFileSync(join(cwd, '.jscpd.json'), 'utf8');
    const config = JSON.parse(raw) as Record<string, unknown>;
    expect(config).toEqual({ minLines: 3, threshold: 0, minTokens: 50 });
    expect(raw.endsWith('\n')).toBe(true);
    expect(result.stdout).toContain('Updated .jscpd.json (added: threshold, minTokens)');
  });

  it('leaves .jscpd.json byte-unchanged without the flag', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    const before = JSON.stringify({ minLines: 3 });
    writeFileSync(join(cwd, '.jscpd.json'), before);
    process.env.PATH = pythonToolsOnPath();
    await runInit(cwd, { prompter: makeAutoPrompter(false), language: 'python' });
    expect(readFileSync(join(cwd, '.jscpd.json'), 'utf8')).toBe(before);
  });

  it('never edits pyproject.toml ruff thresholds even with the flag', async () => {
    const before = '[tool.ruff]\nline-length = 88\n';
    writeFileSync(join(cwd, 'pyproject.toml'), before);
    process.env.PATH = pythonToolsOnPath();
    const result = await runAccept(cwd, 'python', recordingRunner());
    expect(readFileSync(join(cwd, 'pyproject.toml'), 'utf8')).toBe(before);
    expect(result.stdout).toContain('ruff is missing recommended thresholds');
  });

  it('does not execute or write under dry-run even with the flag', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    const before = JSON.stringify({ minLines: 3 });
    writeFileSync(join(cwd, '.jscpd.json'), before);
    process.env.PATH = pythonToolsOnPath();
    const runner = recordingRunner();
    const result = await runInit(cwd, {
      prompter: makeAutoPrompter(false),
      language: 'python',
      acceptRecommendations: true,
      dryRun: true,
      runCommand: runner.runCommand,
    });
    expect(runner.commands).toEqual([]);
    expect(readFileSync(join(cwd, '.jscpd.json'), 'utf8')).toBe(before);
    expect(result.stdout).not.toContain('Applying recommendations:');
  });
});

describe('accept-recommendations advert line', () => {
  let cwd: string;
  let home: string;
  let originalHome: string | undefined;
  let originalPath: string | undefined;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'hh-advert-'));
    home = mkdtempSync(join(tmpdir(), 'hh-advert-home-'));
    originalHome = process.env.HOME;
    originalPath = process.env.PATH;
    process.env.HOME = home;
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo' }));
  });
  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.PATH = originalPath;
    rmSync(cwd, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  function pythonToolsOnPath(): string {
    const bin = mkdtempSync(join(tmpdir(), 'hh-advert-bin-'));
    for (const tool of ['ruff', 'deptry']) writeFileSync(join(bin, tool), '#!/bin/sh\n');
    return bin;
  }

  function fakeJscpdInstalled(): void {
    const binDir = join(cwd, 'node_modules', '.bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, 'jscpd'), '#!/usr/bin/env node\n');
    const pkgDir = join(cwd, 'node_modules', 'jscpd');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'jscpd' }));
  }

  function run(language: Language): ReturnType<typeof runInit> {
    return runInit(cwd, { prompter: makeAutoPrompter(false), language });
  }

  it('appears (no flag) when a tool is missing', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    process.env.PATH = pythonToolsOnPath();
    const result = await run('python');
    expect(result.stdout).toContain('re-run with `--accept-recommendations`');
  });

  it('appears (no flag) when only jscpd keys are missing', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    writeFileSync(join(cwd, '.jscpd.json'), JSON.stringify({ minLines: 5 }));
    fakeJscpdInstalled();
    process.env.PATH = pythonToolsOnPath();
    const result = await run('python');
    expect(result.stdout).toContain('.jscpd.json is missing recommended keys');
    expect(result.stdout).toContain('re-run with `--accept-recommendations`');
  });

  it('is absent when setup is complete with nothing auto-applicable', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    fakeJscpdInstalled();
    process.env.PATH = pythonToolsOnPath();
    const result = await run('python');
    expect(result.stdout).toContain('Setup complete');
    expect(result.stdout).not.toContain('re-run with `--accept-recommendations`');
  });

  it('is absent when only ruff manual items remain', async () => {
    writeFileSync(
      join(cwd, 'pyproject.toml'),
      '[tool.ruff.lint.mccabe]\nmax-complexity = 10\n',
    );
    fakeJscpdInstalled();
    process.env.PATH = pythonToolsOnPath();
    const result = await run('python');
    expect(result.stdout).toContain('ruff is missing recommended thresholds');
    expect(result.stdout).not.toContain('re-run with `--accept-recommendations`');
  });

  it('is absent when the flag is set', async () => {
    writeFileSync(join(cwd, 'pyproject.toml'), '[project]\nname = "x"\n');
    process.env.PATH = pythonToolsOnPath();
    const result = await runInit(cwd, {
      prompter: makeAutoPrompter(false),
      language: 'python',
      acceptRecommendations: true,
      runCommand: () => Promise.resolve({ ok: true, output: '' }),
    });
    expect(result.stdout).not.toContain('re-run with `--accept-recommendations`');
  });
});
