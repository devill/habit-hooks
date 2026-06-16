import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffoldJscpdConfig } from './scaffold-jscpd-config.js';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'hh-jscpd-scaffold-'));
}

describe('scaffoldJscpdConfig', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = makeTempDir();
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('writes .jscpd.json when no config exists', () => {
    const result = scaffoldJscpdConfig(cwd, 'typescript');
    expect(result.created).toBe(true);
    expect(existsSync(join(cwd, '.jscpd.json'))).toBe(true);
  });

  it('encodes v1 default minTokens/minLines', () => {
    scaffoldJscpdConfig(cwd, 'typescript');
    const parsed = JSON.parse(readFileSync(join(cwd, '.jscpd.json'), 'utf8')) as {
      minTokens?: number;
      minLines?: number;
    };
    expect(parsed.minTokens).toBe(50);
    expect(parsed.minLines).toBe(5);
  });

  it('does not overwrite an existing jscpd.json', () => {
    const path = join(cwd, 'jscpd.json');
    writeFileSync(path, '{"existing":true}');
    const result = scaffoldJscpdConfig(cwd, 'typescript');
    expect(result.created).toBe(false);
    expect(readFileSync(path, 'utf8')).toBe('{"existing":true}');
  });

  it('ignores TypeScript test globs for a typescript project', () => {
    scaffoldJscpdConfig(cwd, 'typescript');
    const parsed = JSON.parse(readFileSync(join(cwd, '.jscpd.json'), 'utf8')) as {
      ignore?: string[];
    };
    expect(parsed.ignore).toContain('**/*.test.ts');
  });

  it('ignores Python dirs and test globs for a python project', () => {
    scaffoldJscpdConfig(cwd, 'python');
    const parsed = JSON.parse(readFileSync(join(cwd, '.jscpd.json'), 'utf8')) as {
      ignore?: string[];
    };
    expect(parsed.ignore).toContain('**/__pycache__/**');
    expect(parsed.ignore).toContain('**/*_test.py');
    expect(parsed.ignore).not.toContain('**/*.test.ts');
  });
});
