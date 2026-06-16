import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defaultRules } from './catalogue.js';

const vocabularyPath = join(dirname(fileURLToPath(import.meta.url)), '../../docs/smell-vocabulary.md');

function parseCatalogueTitles(): Map<string, string> {
  const lines = readFileSync(vocabularyPath, 'utf8').split('\n');
  const titles = new Map<string, string>();
  for (const line of lines) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*\w+\s*\|$/);
    if (match) titles.set(match[1], match[2]);
  }
  return titles;
}

describe('catalogue titles', () => {
  const canonicalTitles = parseCatalogueTitles();

  it('match the canonical titles in docs/smell-vocabulary.md', () => {
    for (const rule of defaultRules) {
      expect(canonicalTitles.get(rule.id), `no vocabulary entry for ${rule.id}`).toBeDefined();
      expect(rule.title, `title drift for ${rule.id}`).toBe(canonicalTitles.get(rule.id));
    }
  });
});
