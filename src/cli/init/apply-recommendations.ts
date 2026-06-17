import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeWriteFileSync } from '../../safe-fs.js';
import { detectToolStates, toolsForLanguage, type ToolName, type ToolState } from './detect.js';
import { installCommandsFor } from './install-commands.js';
import { describeKey, JSCPD_RECOMMENDATION } from './recommendations.js';
import type { CommandRunner } from './command-runner.js';
import type { Ctx } from './ctx.js';

// `--accept-recommendations` only auto-applies the safe, mechanical fixes:
// running install commands and additively merging keys into our own
// `.jscpd.json`. We deliberately never edit user-owned ruff.toml / pyproject.toml
// thresholds or eslint flat config — safe in-place TOML/JS editing needs a real
// parser, so those stay reported as manual steps even with the flag.

const HEADER = 'Applying recommendations:\n';

function missingTools(ctx: Ctx, matrix: Record<ToolName, ToolState>): ToolName[] {
  return toolsForLanguage(ctx.language).filter((tool) => !matrix[tool].installed);
}

async function runInstall(ctx: Ctx, command: string, runCommand: CommandRunner): Promise<void> {
  ctx.lines.out.push(`  Running: ${command}\n`);
  const result = await runCommand(command, ctx.cwd);
  if (result.ok) ctx.lines.out.push('    ✓ installed\n');
  else ctx.lines.out.push(`    ✗ failed: ${result.output}\n`);
}

async function installMissingTools(
  ctx: Ctx,
  matrix: Record<ToolName, ToolState>,
  runCommand: CommandRunner,
): Promise<void> {
  const commands = installCommandsFor(ctx.cwd, missingTools(ctx, matrix));
  for (const command of commands) await runInstall(ctx, command, runCommand);
}

function jscpdPath(cwd: string): string {
  return join(cwd, '.jscpd.json');
}

function withAddedKeys(config: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const merged = { ...config };
  for (const key of keys) merged[key] = describeKey(JSCPD_RECOMMENDATION, key).value;
  return merged;
}

function readJscpd(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mergeJscpdConfig(ctx: Ctx): void {
  if (!toolsForLanguage(ctx.language).includes('jscpd')) return;
  const path = jscpdPath(ctx.cwd);
  if (!existsSync(path)) return;
  const missing = JSCPD_RECOMMENDATION.missingKeys(ctx.cwd);
  const config = readJscpd(path);
  if (missing.length === 0 || config === null) return;
  safeWriteFileSync(path, `${JSON.stringify(withAddedKeys(config, missing), null, 2)}\n`);
  ctx.lines.out.push(`  Updated .jscpd.json (added: ${missing.join(', ')})\n`);
}

function jscpdHasMissingKeys(ctx: Ctx): boolean {
  if (!toolsForLanguage(ctx.language).includes('jscpd')) return false;
  if (!existsSync(jscpdPath(ctx.cwd))) return false;
  return JSCPD_RECOMMENDATION.missingKeys(ctx.cwd).length > 0;
}

function hasWork(ctx: Ctx, matrix: Record<ToolName, ToolState>): boolean {
  return missingTools(ctx, matrix).length > 0 || jscpdHasMissingKeys(ctx);
}

export async function applyRecommendations(ctx: Ctx, runCommand: CommandRunner): Promise<void> {
  const matrix = detectToolStates(ctx.cwd);
  if (!hasWork(ctx, matrix)) return;
  ctx.lines.out.push(`\n${HEADER}`);
  await installMissingTools(ctx, matrix, runCommand);
  mergeJscpdConfig(ctx);
}
