import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from './load.js';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'hh-cfg-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('returns empty config and null sourcePath when no file present', async () => {
    const loaded = await loadConfig(workDir);
    expect(loaded.config).toEqual({});
    expect(loaded.sourcePath).toBeNull();
  });

  it('loads a .json config', async () => {
    const cfg = { prompts: './prompts', rules: { 'eslint:max-params': { severity: 'suggested' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(cfg));
    const loaded = await loadConfig(workDir);
    expect(loaded.config.prompts).toBe('./prompts');
    expect(loaded.config.rules?.['eslint:max-params']).toEqual({ severity: 'suggested' });
    expect(loaded.sourcePath).toContain('habit-hooks.config.json');
  });

  it('loads a .mjs config', async () => {
    const content = `export default { rules: { 'eslint:complexity': { severity: 'enforced' } } };\n`;
    writeFileSync(join(workDir, 'habit-hooks.config.mjs'), content);
    const loaded = await loadConfig(workDir);
    expect(loaded.config.rules?.['eslint:complexity']).toEqual({ severity: 'enforced' });
  });

  it('loads a .js config (ESM)', async () => {
    const content = `export default { rules: { 'eslint:complexity': { severity: 'suggested' } } };\n`;
    writeFileSync(join(workDir, 'habit-hooks.config.js'), content);
    const loaded = await loadConfig(workDir);
    expect(loaded.config.rules?.['eslint:complexity']).toEqual({ severity: 'suggested' });
  });

  it('loads a .ts config via jiti', async () => {
    const content = `const config = { rules: { 'eslint:max-params': { severity: 'suggested' as const } } };\nexport default config;\n`;
    writeFileSync(join(workDir, 'habit-hooks.config.ts'), content);
    const loaded = await loadConfig(workDir);
    expect(loaded.config.rules?.['eslint:max-params']).toEqual({ severity: 'suggested' });
  });

  it('prefers .ts over other formats when multiple exist', async () => {
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify({ prompts: 'json' }));
    writeFileSync(
      join(workDir, 'habit-hooks.config.ts'),
      `export default { prompts: 'ts' };\n`,
    );
    const loaded = await loadConfig(workDir);
    expect(loaded.config.prompts).toBe('ts');
    expect(loaded.sourcePath).toContain('.ts');
  });

  it('throws naming the field path on bad severity', async () => {
    const bad = { rules: { 'eslint:max-params': { severity: 'wrong' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /rules\.eslint:max-params\.severity must be 'enforced' or 'suggested'/,
    );
  });

  it('throws naming the field path on bad include type', async () => {
    const bad = { rules: { 'eslint:max-params': { include: 'src/**' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /rules\.eslint:max-params\.include must be an array of strings/,
    );
  });

  it('throws when rules is not an object', async () => {
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify({ rules: [] }));
    await expect(loadConfig(workDir)).rejects.toThrow(/rules must be an object/);
  });
});
