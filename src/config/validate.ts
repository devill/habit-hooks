import type { Severity, RuleSource } from '../types.js';
import type {
  CommentCheckConfig,
  HabitHooksConfig,
  RuleDefinition,
  RuleOverride,
  ScopeConfig,
} from './schema.js';

const SEVERITIES: readonly Severity[] = ['enforced', 'suggested'];
const SOURCES: readonly RuleSource[] = ['eslint', 'jscpd', 'custom'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function fail(path: string, expected: string): never {
  throw new Error(`Invalid habit-hooks config: ${path} must be ${expected}`);
}

function validateOptionalString(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'string') fail(path, 'a string');
}

function validateOptionalBoolean(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'boolean') fail(path, 'a boolean');
}

function validateOptionalStringArray(value: unknown, path: string): void {
  if (value === undefined) return;
  if (!isStringArray(value)) fail(path, 'an array of strings');
}

function validateSeverity(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'string' || !SEVERITIES.includes(value as Severity)) {
    fail(path, `'enforced' or 'suggested'`);
  }
}

function validateSource(value: unknown, path: string): void {
  if (typeof value !== 'string' || !SOURCES.includes(value as RuleSource)) {
    fail(path, `one of 'eslint', 'jscpd', 'custom'`);
  }
}

function validateRuleOverrideFields(entry: Record<string, unknown>, base: string): void {
  validateSeverity(entry.severity, `${base}.severity`);
  validateOptionalBoolean(entry.changedFilesOnly, `${base}.changedFilesOnly`);
  validateOptionalString(entry.title, `${base}.title`);
  validateOptionalString(entry.description, `${base}.description`);
  validateOptionalBoolean(entry.disabled, `${base}.disabled`);
  validateOptionalStringArray(entry.include, `${base}.include`);
  validateOptionalStringArray(entry.exclude, `${base}.exclude`);
}

function validateRuleDefinitionFields(
  entry: Record<string, unknown>,
  base: string,
): void {
  if (typeof entry.id !== 'string') fail(`${base}.id`, 'a string');
  validateSource(entry.source, `${base}.source`);
  validateOptionalString(entry.sourceRuleId, `${base}.sourceRuleId`);
}

function validateRuleEntry(value: unknown, base: string): RuleOverride | RuleDefinition {
  if (!isPlainObject(value)) fail(base, 'an object');
  const entry = value;
  validateRuleOverrideFields(entry, base);
  if ('source' in entry) {
    validateRuleDefinitionFields(entry, base);
  }
  return entry as RuleOverride | RuleDefinition;
}

function validateRules(value: unknown): HabitHooksConfig['rules'] {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) fail('rules', 'an object keyed by rule id');
  const result: Record<string, RuleOverride | RuleDefinition> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = validateRuleEntry(entry, `rules.${key}`);
  }
  return result;
}

function validateScope(value: unknown): ScopeConfig | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) fail('scope', 'an object');
  validateOptionalBoolean(value.onlyChangedFiles, 'scope.onlyChangedFiles');
  validateOptionalBoolean(value.autoBranchOffMain, 'scope.autoBranchOffMain');
  validateOptionalString(value.branchBase, 'scope.branchBase');
  validateOptionalString(value.mainBranch, 'scope.mainBranch');
  return value as ScopeConfig;
}

function validatePositiveInteger(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    fail(path, 'a positive integer');
  }
}

function validateCommentCheck(value: unknown): CommentCheckConfig | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) fail('commentCheck', 'an object');
  validatePositiveInteger(value.maxSingleLineChars, 'commentCheck.maxSingleLineChars');
  validatePositiveInteger(value.maxBlockChars, 'commentCheck.maxBlockChars');
  return value as CommentCheckConfig;
}

export function validateConfig(value: unknown): HabitHooksConfig {
  if (!isPlainObject(value)) fail('config', 'an object');
  validateOptionalString(value.prompts, 'prompts');
  const rules = validateRules(value.rules);
  const scope = validateScope(value.scope);
  const commentCheck = validateCommentCheck(value.commentCheck);
  const config: HabitHooksConfig = {};
  if (typeof value.prompts === 'string') config.prompts = value.prompts;
  if (rules !== undefined) config.rules = rules;
  if (scope !== undefined) config.scope = scope;
  if (commentCheck !== undefined) config.commentCheck = commentCheck;
  return config;
}
