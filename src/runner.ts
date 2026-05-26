import { dirname, relative } from 'node:path';
import fg from 'fast-glob';
import picomatch from 'picomatch';
import { eslintCheck } from './checks/eslint-check.js';
import { loadConfig, loadConfigFromPath } from './config/load.js';
import { buildRules } from './rules/registry.js';
import { report } from './reporter.js';
import { resolveScope, type ResolvedScope, type ScopeFlags } from './git/resolve-scope.js';
import { loadBaseline, type BaselineFile } from './baseline/store.js';
import { partitionBySnooze } from './baseline/filter.js';
import type { HabitHooksConfig } from './config/schema.js';
import type { Rule, Violation } from './types.js';

export interface RunResult {
  stdout: string;
  exitCode: number;
  violations: Violation[];
}

export interface RunOptions {
  configPath?: string;
  scopeFlags?: ScopeFlags;
  applyBaseline?: boolean;
}

interface RunContext {
  cwd: string;
  files: string[];
  scope: ResolvedScope;
  baseline: BaselineFile | null;
}

interface FileSetGroup {
  rules: Rule[];
  files: string[];
}

async function discoverFiles(cwd: string): Promise<string[]> {
  return fg(['**/*.{ts,tsx,js,mjs,cjs}'], {
    cwd,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
    dot: false,
  });
}

function buildMatcher(patterns: string[] | undefined): ((path: string) => boolean) | null {
  if (!patterns || patterns.length === 0) return null;
  return picomatch(patterns);
}

function filterFilesForRule(rule: Rule, files: string[], cwd: string): string[] {
  const includeMatcher = buildMatcher(rule.include);
  const excludeMatcher = buildMatcher(rule.exclude);
  if (!includeMatcher && !excludeMatcher) return files;
  return files.filter((file) => {
    const rel = relative(cwd, file);
    if (includeMatcher && !includeMatcher(rel)) return false;
    if (excludeMatcher && excludeMatcher(rel)) return false;
    return true;
  });
}

function applyScopeToRule(rule: Rule, files: string[], scope: ResolvedScope): string[] {
  if (!rule.changedFilesOnly) return files;
  if (scope.changedFiles === null) return files;
  return files.filter((file) => scope.changedFiles!.has(file));
}

function applyBaselineToRule(files: string[], ctx: RunContext): string[] {
  if (ctx.baseline === null) return files;
  // TODO: surface ctx-level skipped list via a verbose flag when phase 6 adds it.
  return partitionBySnooze(files, ctx.baseline, ctx.cwd).active;
}

function resolveFilesForRule(rule: Rule, ctx: RunContext): string[] {
  const filtered = filterFilesForRule(rule, ctx.files, ctx.cwd);
  const scoped = applyScopeToRule(rule, filtered, ctx.scope);
  return applyBaselineToRule(scoped, ctx);
}

function addRuleToGroup(
  groups: Map<string, FileSetGroup>,
  rule: Rule,
  files: string[],
): void {
  const key = files.join('\0');
  const existing = groups.get(key);
  if (existing) existing.rules.push(rule);
  else groups.set(key, { rules: [rule], files });
}

function groupByFileSet(rules: Rule[], ctx: RunContext): FileSetGroup[] {
  const groups = new Map<string, FileSetGroup>();
  for (const rule of rules) {
    addRuleToGroup(groups, rule, resolveFilesForRule(rule, ctx));
  }
  return [...groups.values()];
}

async function runEslintRules(rules: Rule[], ctx: RunContext): Promise<Violation[]> {
  const eslintRules = rules.filter((rule) => rule.source === 'eslint');
  const groups = groupByFileSet(eslintRules, ctx);
  const violations: Violation[] = [];
  for (const group of groups) {
    if (group.files.length === 0) continue;
    violations.push(...(await eslintCheck.run(group.files, group.rules, ctx.cwd)));
  }
  return violations;
}

async function resolveConfig(
  cwd: string,
  options: RunOptions,
): Promise<{ config: HabitHooksConfig; configDir: string }> {
  if (options.configPath !== undefined) {
    const loaded = await loadConfigFromPath(options.configPath);
    return { config: loaded.config, configDir: dirname(options.configPath) };
  }
  const loaded = await loadConfig(cwd);
  const configDir = loaded.sourcePath ? dirname(loaded.sourcePath) : cwd;
  return { config: loaded.config, configDir };
}

function resolveBaseline(cwd: string, options: RunOptions): BaselineFile | null {
  if (options.applyBaseline === false) return null;
  return loadBaseline(cwd);
}

export async function run(cwd: string, options: RunOptions = {}): Promise<RunResult> {
  const { config, configDir } = await resolveConfig(cwd, options);
  const rules = buildRules(config, configDir);
  const files = await discoverFiles(cwd);
  const scope = resolveScope(options.scopeFlags ?? {}, config.scope, cwd);
  const baseline = resolveBaseline(cwd, options);
  const violations = await runEslintRules(rules, { cwd, files, scope, baseline });
  const reported = report(violations, rules);
  return { ...reported, violations };
}
