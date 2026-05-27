import type { RuleSource, Severity } from '../types.js';

export interface RuleOverride {
  severity?: Severity;
  changedFilesOnly?: boolean;
  title?: string;
  description?: string;
  disabled?: boolean;
  include?: string[];
  exclude?: string[];
}

export interface RuleDefinition extends RuleOverride {
  id: string;
  source: RuleSource;
  sourceRuleId?: string;
}

export interface ScopeConfig {
  onlyChangedFiles?: boolean;
  autoBranchOffMain?: boolean;
  branchBase?: string;
  mainBranch?: string;
}

export interface CommentCheckConfig {
  maxSingleLineChars?: number;
  maxBlockChars?: number;
}

export interface HabitHooksConfig {
  prompts?: string;
  rules?: Record<string, RuleOverride | RuleDefinition>;
  scope?: ScopeConfig;
  commentCheck?: CommentCheckConfig;
}

export function isRuleDefinition(
  entry: RuleOverride | RuleDefinition,
): entry is RuleDefinition {
  return 'source' in entry && typeof (entry as RuleDefinition).source === 'string';
}
