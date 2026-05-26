import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadGuidance } from './loader.js';

describe('loadGuidance', () => {
  it('loads stub markdown for a known rule id', () => {
    const text = loadGuidance('eslint:max-params');
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/parameters/i);
  });

  it('throws for an unknown rule id', () => {
    expect(() => loadGuidance('eslint:does-not-exist')).toThrow(/No guidance found/);
  });

  describe('with overrideDir', () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'hh-prompts-'));
    });
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('prefers override over packaged when present', () => {
      writeFileSync(join(dir, 'eslint-max-params.md'), 'CUSTOM PROMPT');
      const text = loadGuidance('eslint:max-params', { overrideDir: dir });
      expect(text).toBe('CUSTOM PROMPT');
    });

    it('falls back to packaged when override missing', () => {
      const text = loadGuidance('eslint:max-params', { overrideDir: dir });
      expect(text).toMatch(/parameters/i);
    });

    it('error names both attempted paths when none match', () => {
      const packagedDir = mkdtempSync(join(tmpdir(), 'hh-pkg-'));
      try {
        const err = (() => {
          try {
            loadGuidance('eslint:missing', { overrideDir: dir, packagedDir });
          } catch (e) {
            return e as Error;
          }
          return null;
        })();
        expect(err).not.toBeNull();
        expect(err?.message).toContain(dir);
        expect(err?.message).toContain(packagedDir);
      } finally {
        rmSync(packagedDir, { recursive: true, force: true });
      }
    });
  });
});
