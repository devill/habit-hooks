import { describe, expect, it } from 'vitest';
import { extractIssues, type AdapterSpec } from './adapter.js';

// Shapes captured from live tool output (the Phase-5 de-risk):
// ruff --output-format=json is a flat array; eslint -f json nests messages per file.

const RUFF_SPEC: AdapterSpec = {
  id: 'ruff',
  command: 'ruff check --output-format=json ${files}',
  items: '[]',
  fields: { smell: 'code', file: 'filename', line: 'location.row', column: 'location.column', message: 'message' },
  map: { C901: 'high-complexity', PLR0913: 'too-many-parameters', PLR0915: 'oversized-function', F841: 'unused-variable' },
};

const RUFF_JSON = [
  {
    code: 'PLR0913',
    filename: '/p/sample.py',
    location: { row: 1, column: 5 },
    message: 'Too many arguments in function definition (6 > 5)',
  },
  {
    code: 'F841',
    filename: '/p/sample.py',
    location: { row: 3, column: 5 },
    message: "Local variable `unused` is assigned to but never used",
  },
  { code: 'XYZ999', filename: '/p/sample.py', location: { row: 9, column: 1 }, message: 'unmapped rule' },
];

const ESLINT_SPEC: AdapterSpec = {
  id: 'eslint',
  command: 'eslint -f json ${files}',
  group: '[]',
  items: 'messages[]',
  fields: { smell: 'ruleId', file: 'group.filePath', line: 'line', column: 'column', message: 'message' },
  map: { 'max-params': 'too-many-parameters', complexity: 'high-complexity' },
};

const ESLINT_JSON = [
  {
    filePath: '/p/a.ts',
    messages: [
      { ruleId: 'max-params', line: 1, column: 77, message: 'Arrow function has too many parameters (4).' },
      { ruleId: 'complexity', line: 1, column: 1, message: 'Arrow function has a complexity of 15.' },
    ],
  },
  { filePath: '/p/b.ts', messages: [{ ruleId: 'no-console', line: 2, column: 1, message: 'Unexpected console.' }] },
];

describe('extractIssues — flat (ruff)', () => {
  it('maps each element to a canonical smell with details and provenance', () => {
    const issues = extractIssues(RUFF_JSON, RUFF_SPEC);
    expect(issues.map((i) => i.smell)).toEqual([
      'too-many-parameters',
      'unused-variable',
      'XYZ999', // unmapped raw code passes through (uncoached)
    ]);
    expect(issues[0]?.details).toEqual({
      file: '/p/sample.py',
      line: 1,
      column: 5,
      message: 'Too many arguments in function definition (6 > 5)',
      source: 'ruff:PLR0913',
    });
    expect(issues[2]?.details.source).toBe('ruff:XYZ999');
  });
});

describe('extractIssues — nested (eslint)', () => {
  it('reads inner messages and pulls file from the outer group entry', () => {
    const issues = extractIssues(ESLINT_JSON, ESLINT_SPEC);
    expect(issues.map((i) => i.smell)).toEqual(['too-many-parameters', 'high-complexity', 'no-console']);
    expect(issues[0]?.details).toEqual({
      file: '/p/a.ts',
      line: 1,
      column: 77,
      message: 'Arrow function has too many parameters (4).',
      source: 'eslint:max-params',
    });
    expect(issues[2]?.details.file).toBe('/p/b.ts');
  });
});

describe('extractIssues — robustness', () => {
  it('returns no issues for an empty or malformed root', () => {
    expect(extractIssues([], RUFF_SPEC)).toEqual([]);
    expect(extractIssues({ not: 'an array' }, RUFF_SPEC)).toEqual([]);
    expect(extractIssues(null, ESLINT_SPEC)).toEqual([]);
  });

  it('omits missing optional fields from details', () => {
    const spec: AdapterSpec = { ...RUFF_SPEC, map: undefined };
    const issues = extractIssues([{ code: 'C901', filename: '/p/x.py', message: 'm' }], spec);
    expect(issues[0]?.smell).toBe('C901');
    expect('line' in (issues[0]?.details ?? {})).toBe(false);
  });
});
