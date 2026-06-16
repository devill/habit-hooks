import { scaffoldEslintConfig } from './scaffold-eslint-config.js';
import { scaffoldKnipConfig } from './scaffold-knip-config.js';
import { scaffoldJscpdConfig } from './scaffold-jscpd-config.js';
import { scaffoldRuffConfig } from './scaffold-ruff-config.js';
import { detectToolStates, toolsForLanguage, type ToolName, type ToolState } from './detect.js';
import { installCommandsFor } from './install-commands.js';
import { dryRunPath, noteScaffold, type Ctx } from './ctx.js';
import type { ScaffoldResult } from './scaffold-config.js';

type Scaffolder = (_ctx: Ctx) => ScaffoldResult;

const SCAFFOLDERS: Partial<Record<ToolName, Scaffolder>> = {
  eslint: (ctx) => scaffoldEslintConfig(ctx.cwd),
  knip: (ctx) => scaffoldKnipConfig(ctx.cwd),
  jscpd: (ctx) => scaffoldJscpdConfig(ctx.cwd, ctx.language),
  ruff: (ctx) => scaffoldRuffConfig(ctx.cwd),
};

const DEFAULT_FILENAMES: Partial<Record<ToolName, string>> = {
  eslint: 'eslint.config.js',
  knip: 'knip.json',
  jscpd: '.jscpd.json',
  ruff: 'ruff.toml',
};

const UNSCAFFOLDABLE_NOTES: Partial<Record<ToolName, string>> = {
  deptry: 'deptry has no config file; ensure pyproject.toml declares your dependencies\n',
};

const KNIP_STARTER_NOTE =
  'knip.json written with starter entry points. Edit `entry` in knip.json to match your project.\n';

function noteKnipStarter(ctx: Ctx, result: ScaffoldResult): void {
  if (result.created) ctx.lines.out.push(KNIP_STARTER_NOTE);
}

function writeScaffold(ctx: Ctx, tool: ToolName, scaffolder: Scaffolder): void {
  const result = scaffolder(ctx);
  noteScaffold(ctx, result, `${tool} config`);
  if (tool === 'knip') noteKnipStarter(ctx, result);
}

function scaffoldFor(ctx: Ctx, tool: ToolName): void {
  const scaffolder = SCAFFOLDERS[tool];
  const filename = DEFAULT_FILENAMES[tool];
  if (scaffolder === undefined || filename === undefined) return noteUnscaffoldable(ctx, tool);
  if (ctx.dryRun) return dryRunPath(ctx, filename, `${tool} config`);
  writeScaffold(ctx, tool, scaffolder);
}

function noteUnscaffoldable(ctx: Ctx, tool: ToolName): void {
  const note = UNSCAFFOLDABLE_NOTES[tool];
  if (note !== undefined) ctx.lines.out.push(note);
}

function handleTool(ctx: Ctx, tool: ToolName, state: ToolState): void {
  if (state.installed && state.configured) {
    ctx.lines.out.push(`${tool} already installed and configured\n`);
    return;
  }
  if (state.configured) ctx.lines.out.push(`${tool} config already present (binary missing)\n`);
  else scaffoldFor(ctx, tool);
}

function collectMissingTools(tools: ToolName[], matrix: Record<ToolName, ToolState>): ToolName[] {
  return tools.filter((t) => !matrix[t].installed);
}

function printInstallCommands(ctx: Ctx, missing: ToolName[]): void {
  const commands = installCommandsFor(ctx.cwd, missing);
  if (commands.length === 0) return;
  ctx.lines.out.push('\nTo install missing tools, run:\n');
  for (const command of commands) ctx.lines.out.push(`  ${command}\n`);
}

export function runToolSteps(ctx: Ctx): void {
  const tools = toolsForLanguage(ctx.language);
  if (tools.length === 0) return;
  const matrix = detectToolStates(ctx.cwd);
  for (const tool of tools) handleTool(ctx, tool, matrix[tool]);
  printInstallCommands(ctx, collectMissingTools(tools, matrix));
}
