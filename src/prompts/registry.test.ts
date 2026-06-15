import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { listPrompts, lookupPrompt } from './registry.js';

describe('lookupPrompt', () => {
  it('returns a populated CoachingPrompt for a known rule id', () => {
    const prompt = lookupPrompt('too-many-parameters');

    expect(prompt).not.toBeNull();
    expect(prompt?.id).toBe('too-many-parameters');
    expect(prompt?.title).toMatch(/parameters/i);
    expect(prompt?.description.length).toBeGreaterThan(0);
    expect(prompt?.severity).toBe('enforced');
    expect(prompt?.guidancePath).toMatch(/too-many-parameters\.md$/);
    expect(existsSync(prompt?.guidancePath ?? '')).toBe(true);
  });

  it('resolves a smell-keyed prompt to its slug markdown file', () => {
    const prompt = lookupPrompt('non-null-assertion');
    expect(prompt?.id).toBe('non-null-assertion');
    expect(prompt?.guidancePath).toMatch(/non-null-assertion\.md$/);
  });

  it('returns null for an unknown smell key', () => {
    expect(lookupPrompt('does-not-exist')).toBeNull();
  });

  it('defaults severity to suggested when not explicitly set', () => {
    const prompt = lookupPrompt('non-essential-comment');
    expect(prompt?.severity).toBe('suggested');
  });

  it('registers the parse-error supplemental prompt with a tuned markdown file', () => {
    const prompt = lookupPrompt('parse-error');
    expect(prompt, 'missing supplemental prompt parse-error').not.toBeNull();
    expect(existsSync(prompt?.guidancePath ?? '')).toBe(true);
    expect(prompt?.severity).toBe('enforced');
  });

  it('does not register uncatalogued smells (they fall through to uncoached)', () => {
    const demoted = ['some-future-smell', 'no-console', 'enumMembers'];
    for (const id of demoted) {
      expect(lookupPrompt(id), `unexpected supplemental prompt ${id}`).toBeNull();
    }
  });
});

describe('listPrompts', () => {
  it('returns the full set with no duplicates by id', () => {
    const prompts = listPrompts();
    const ids = prompts.map((p) => p.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes every source family', () => {
    const ids = listPrompts().map((p) => p.id);
    expect(ids).toContain('too-many-parameters');
    expect(ids).toContain('duplicated-code');
    expect(ids).toContain('unused-class-member');
    expect(ids).toContain('non-essential-comment');
  });
});
