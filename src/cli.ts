#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { Command } from 'commander';
import { run } from './runner.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(here, '..', 'package.json');
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };

interface CliOptions {
  version?: boolean;
  config?: string;
}

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`habit-hooks: ${message}\n`);
  process.exitCode = 2;
}

async function executeRun(configOpt: string | undefined): Promise<void> {
  const configPath = configOpt !== undefined ? resolve(process.cwd(), configOpt) : undefined;
  const result = await run(process.cwd(), { configPath });
  process.stdout.write(result.stdout);
  process.exitCode = result.exitCode;
}

async function runWithOptions(opts: CliOptions): Promise<void> {
  if (opts.version === true) {
    process.stdout.write(`habit-hooks v${pkg.version}\n`);
    return;
  }
  try {
    await executeRun(opts.config);
  } catch (error) {
    reportError(error);
  }
}

const program = new Command();

program
  .name('habit-hooks')
  .option('--version', 'print version')
  .option('--config <path>', 'path to a habit-hooks config file')
  .action(async () => {
    await runWithOptions(program.opts<CliOptions>());
  });

await program.parseAsync(process.argv);
