import { isAbsolute, resolve } from 'node:path';
import type { Rule } from '../types.js';
import { defaultConfig, defaultRules } from '../config/defaults.js';
import { mergeRules } from '../config/merge.js';
import type { HabitHooksConfig } from '../config/schema.js';
import { loadGuidance } from '../prompts/loader.js';

function resolvePromptsDir(config: HabitHooksConfig, configDir: string): string | undefined {
  if (config.prompts === undefined) return undefined;
  return isAbsolute(config.prompts) ? config.prompts : resolve(configDir, config.prompts);
}

function attachGuidance(rules: Rule[], overrideDir: string | undefined): Rule[] {
  return rules.map((rule) => ({
    ...rule,
    guidance: loadGuidance(rule.id, { overrideDir }),
  }));
}

export function buildRules(config: HabitHooksConfig, configDir: string): Rule[] {
  const merged = mergeRules(defaultRules, defaultConfig.rules, config.rules);
  const overrideDir = resolvePromptsDir(config, configDir);
  return attachGuidance(merged, overrideDir);
}

export function getRules(): Rule[] {
  return buildRules({}, process.cwd());
}
