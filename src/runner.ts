import { dirname, relative } from 'node:path';
import fg from 'fast-glob';
import picomatch from 'picomatch';
import { eslintCheck } from './checks/eslint-check.js';
import { loadConfig, loadConfigFromPath } from './config/load.js';
import { buildRules } from './rules/registry.js';
import { report } from './reporter.js';
import type { Rule, Violation } from './types.js';

export interface RunResult {
  stdout: string;
  exitCode: number;
}

export interface RunOptions {
  configPath?: string;
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

async function runEslintRules(
  rules: Rule[],
  files: string[],
  cwd: string,
): Promise<Violation[]> {
  const eslintRules = rules.filter((rule) => rule.source === 'eslint');
  const violations: Violation[] = [];
  const groups = groupByFileSet(eslintRules, files, cwd);
  for (const { rules: groupRules, files: groupFiles } of groups) {
    const result = await eslintCheck.run(groupFiles, groupRules);
    violations.push(...result);
  }
  return violations;
}

interface FileSetGroup {
  rules: Rule[];
  files: string[];
}

function groupByFileSet(rules: Rule[], files: string[], cwd: string): FileSetGroup[] {
  const groups = new Map<string, FileSetGroup>();
  for (const rule of rules) {
    const filtered = filterFilesForRule(rule, files, cwd);
    const key = filtered.join('\0');
    const existing = groups.get(key);
    if (existing) {
      existing.rules.push(rule);
    } else {
      groups.set(key, { rules: [rule], files: filtered });
    }
  }
  return [...groups.values()];
}

async function resolveConfig(
  cwd: string,
  options: RunOptions,
): Promise<{ config: Parameters<typeof buildRules>[0]; configDir: string }> {
  if (options.configPath !== undefined) {
    const loaded = await loadConfigFromPath(options.configPath);
    return { config: loaded.config, configDir: dirname(options.configPath) };
  }
  const loaded = await loadConfig(cwd);
  const configDir = loaded.sourcePath ? dirname(loaded.sourcePath) : cwd;
  return { config: loaded.config, configDir };
}

export async function run(cwd: string, options: RunOptions = {}): Promise<RunResult> {
  const { config, configDir } = await resolveConfig(cwd, options);
  const rules = buildRules(config, configDir);
  const files = await discoverFiles(cwd);
  const violations = await runEslintRules(rules, files, cwd);
  return report(violations, rules);
}
