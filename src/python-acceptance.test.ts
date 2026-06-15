import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run } from './runner.js';

const here = dirname(fileURLToPath(import.meta.url));
const pythonProject = join(here, '..', 'tests', 'fixtures', 'python-project');

// The Python preset shells out to ruff and deptry; skip the e2e where the Python
// toolchain is absent (CI without it) so the suite stays green everywhere.
const PY_TOOLS =
  spawnSync('ruff', ['--version']).status === 0 && spawnSync('deptry', ['--version']).status === 0;

interface ExpectedCount {
  ruleId: string;
  count: number;
}

// Proves one mapper/guide vocabulary serves Python by swapping only the sensor
// layer: ruff -> complexity/params/unused-var/unused-import, jscpd -> duplicated
// code on .py, deptry -> unused-dependency.
const EXPECTED: ExpectedCount[] = [
  { ruleId: 'too-many-parameters', count: 1 },
  { ruleId: 'high-complexity', count: 1 },
  { ruleId: 'unused-variable', count: 1 },
  { ruleId: 'unused-import', count: 1 },
  { ruleId: 'duplicated-code', count: 2 },
  { ruleId: 'unused-dependency', count: 1 },
];

function countBy(violations: { ruleId: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of violations) counts.set(v.ruleId, (counts.get(v.ruleId) ?? 0) + 1);
  return counts;
}

describe.skipIf(!PY_TOOLS)('acceptance: python preset on python-project fixture', () => {
  it('fires each expected python smell exactly once (duplicated-code twice)', async () => {
    const result = await run(pythonProject);
    const counts = countBy(result.violations);
    for (const { ruleId, count } of EXPECTED) {
      expect(counts.get(ruleId) ?? 0, `smell ${ruleId}`).toBe(count);
    }
  }, 30_000);

  it('exits non-zero because enforced python smells are present', async () => {
    expect((await run(pythonProject)).exitCode).toBe(1);
  }, 30_000);
});
