import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectLanguage, scaffoldConfig } from './scaffold-config.js';

describe('detectLanguage', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hh-lang-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('detects python from a pyproject.toml manifest', () => {
    writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "x"\n');
    expect(detectLanguage(dir)).toBe('python');
  });

  it('detects python from setup.py', () => {
    writeFileSync(join(dir, 'setup.py'), '');
    expect(detectLanguage(dir)).toBe('python');
  });

  it('defaults to typescript', () => {
    expect(detectLanguage(dir)).toBe('typescript');
  });

  it('scaffolds a config carrying the selected language', () => {
    writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "x"\n');
    const result = scaffoldConfig(dir);
    expect(result.created).toBe(true);
    expect(readFileSync(result.path, 'utf8')).toContain("language: 'python'");
  });
});
