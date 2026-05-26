import { ESLint, type Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import type { Check, Rule, Violation } from '../types.js';

function buildRuleConfig(rules: Rule[]): Linter.RulesRecord {
  const config: Linter.RulesRecord = {};
  for (const rule of rules) {
    if (rule.source !== 'eslint' || !rule.sourceRuleId) continue;
    const options = Array.isArray(rule.eslintOptions) ? rule.eslintOptions : [];
    config[rule.sourceRuleId] = ['error', ...options];
  }
  return config;
}

function buildSourceRuleIndex(rules: Rule[]): Map<string, Rule> {
  const index = new Map<string, Rule>();
  for (const rule of rules) {
    if (rule.source === 'eslint' && rule.sourceRuleId) {
      index.set(rule.sourceRuleId, rule);
    }
  }
  return index;
}

function createESLint(rules: Rule[]): ESLint {
  return new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: { parser: tseslint.parser },
      },
      { rules: buildRuleConfig(rules) },
    ],
  });
}

async function lintFiles(eslint: ESLint, files: string[]): Promise<ESLint.LintResult[]> {
  if (files.length === 0) return [];
  return eslint.lintFiles(files);
}

function toViolation(
  rule: Rule,
  filePath: string,
  message: Linter.LintMessage,
): Violation {
  return {
    ruleId: rule.id,
    file: filePath,
    line: message.line,
    column: message.column,
    message: message.message,
  };
}

function tryMapMessage(
  message: Linter.LintMessage,
  filePath: string,
  index: Map<string, Rule>,
): Violation | null {
  if (!message.ruleId) return null;
  const rule = index.get(message.ruleId);
  if (!rule) return null;
  return toViolation(rule, filePath, message);
}

function collectViolations(
  results: ESLint.LintResult[],
  index: Map<string, Rule>,
): Violation[] {
  return results.flatMap((result) =>
    result.messages
      .map((m) => tryMapMessage(m, result.filePath, index))
      .filter((v): v is Violation => v !== null),
  );
}

export const eslintCheck: Check = {
  id: 'eslint',
  async run(files, rules) {
    const eslint = createESLint(rules);
    const index = buildSourceRuleIndex(rules);
    const results = await lintFiles(eslint, files);
    return collectViolations(results, index);
  },
};
