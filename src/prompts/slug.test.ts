import { describe, expect, it } from 'vitest';
import { slugify } from './slug.js';

describe('slugify', () => {
  it('maps rule ids to filename stems (drops @, replaces :/)', () => {
    expect(slugify('eslint:max-params')).toBe('eslint-max-params');
    expect(slugify('@typescript-eslint/no-explicit-any')).toBe('typescript-eslint-no-explicit-any');
  });

  it('neutralizes path separators so an id cannot traverse out of a dir', () => {
    expect(slugify('../../etc/passwd')).toBe('..-..-etc-passwd');
    expect(slugify('..\\..\\windows')).toBe('..-..-windows');
    expect(slugify('a/b\\c')).toBe('a-b-c');
  });
});
