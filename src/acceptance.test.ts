import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run } from './runner.js';

const here = dirname(fileURLToPath(import.meta.url));
const sampleProject = join(here, '..', 'tests', 'fixtures', 'sample-project');

interface ExpectedCount {
  ruleId: string;
  count: number;
}

const EXPECTED: ExpectedCount[] = [
  { ruleId: 'oversized-function', count: 1 },
  { ruleId: 'too-many-parameters', count: 1 },
  { ruleId: 'high-complexity', count: 1 },
  { ruleId: 'oversized-file', count: 1 },
  { ruleId: 'unused-variable', count: 1 },
  { ruleId: 'loose-equality', count: 1 },
  { ruleId: 'var-declaration', count: 1 },
  { ruleId: 'non-const-binding', count: 1 },
  { ruleId: 'duplicate-import', count: 1 },
  { ruleId: 'warning-comment', count: 1 },
  { ruleId: 'explicit-any', count: 1 },
  { ruleId: 'non-null-assertion', count: 1 },
  { ruleId: 'redundant-type-annotation', count: 1 },
  { ruleId: 'non-essential-comment', count: 1 },
  { ruleId: 'duplicated-code', count: 2 },
  { ruleId: 'unused-class-member', count: 1 },
];

function countBy(violations: { ruleId: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of violations) {
    counts.set(v.ruleId, (counts.get(v.ruleId) ?? 0) + 1);
  }
  return counts;
}

describe('acceptance: default rule set on sample-project fixture', () => {
  it('every default rule fires the expected number of times', async () => {
    const result = await run(sampleProject);
    const counts = countBy(result.violations);
    for (const { ruleId, count } of EXPECTED) {
      expect(counts.get(ruleId) ?? 0, `rule ${ruleId}`).toBe(count);
    }
  });

  it('exits non-zero because enforced violations are present', async () => {
    const result = await run(sampleProject);
    expect(result.exitCode).toBe(1);
  });
});
