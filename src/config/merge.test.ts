import { describe, expect, it } from 'vitest';
import type { Rule } from '../types.js';
import { mergeRules } from './merge.js';

const base: Rule[] = [
  {
    id: 'too-many-parameters',
    source: 'eslint',
    sourceRuleId: 'max-params',
    severity: 'enforced',
    changedFilesOnly: false,
    title: 'Too many parameters',
    description: 'desc',
  },
  {
    id: 'high-complexity',
    source: 'eslint',
    sourceRuleId: 'complexity',
    severity: 'suggested',
    changedFilesOnly: false,
    title: 'Complex',
    description: 'desc',
  },
];

describe('mergeRules', () => {
  it('returns defaults when overrides are empty', () => {
    const result = mergeRules(base, undefined);
    expect(result).toEqual(base);
  });

  it('overrides severity', () => {
    const result = mergeRules(base, {
      'too-many-parameters': { severity: 'suggested' },
    });
    const target = result.find((r) => r.id === 'too-many-parameters');
    expect(target?.severity).toBe('suggested');
  });

  it('removes a disabled rule', () => {
    const result = mergeRules(base, {
      'high-complexity': { disabled: true },
    });
    expect(result.map((r) => r.id)).not.toContain('high-complexity');
  });

  it('appends a custom rule definition', () => {
    const result = mergeRules(base, {
      'custom:my-check': {
        id: 'custom:my-check',
        source: 'custom',
        severity: 'enforced',
        title: 'Custom',
        description: 'Custom desc',
      },
    });
    const custom = result.find((r) => r.id === 'custom:my-check');
    expect(custom?.source).toBe('custom');
    expect(custom?.severity).toBe('enforced');
  });

  it('applies include and exclude patterns', () => {
    const result = mergeRules(base, {
      'too-many-parameters': { include: ['src/**'], exclude: ['**/*.test.ts'] },
    });
    const target = result.find((r) => r.id === 'too-many-parameters');
    expect(target?.include).toEqual(['src/**']);
    expect(target?.exclude).toEqual(['**/*.test.ts']);
  });

  it('merges multiple override sources (later wins per field)', () => {
    const result = mergeRules(
      base,
      { 'too-many-parameters': { exclude: ['tests/**'] } },
      { 'too-many-parameters': { severity: 'suggested' } },
    );
    const target = result.find((r) => r.id === 'too-many-parameters');
    expect(target?.exclude).toEqual(['tests/**']);
    expect(target?.severity).toBe('suggested');
  });
});
