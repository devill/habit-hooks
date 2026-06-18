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
    const cfg = { prompts: './prompts', rules: { 'too-many-parameters': { severity: 'suggested' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(cfg));
    const loaded = await loadConfig(workDir);
    expect(loaded.config.prompts).toBe('./prompts');
    expect(loaded.config.rules?.['too-many-parameters']).toEqual({ severity: 'suggested' });
    expect(loaded.sourcePath).toContain('habit-hooks.config.json');
  });

  it('loads a .mjs config', async () => {
    const content = `export default { rules: { 'high-complexity': { severity: 'enforced' } } };\n`;
    writeFileSync(join(workDir, 'habit-hooks.config.mjs'), content);
    const loaded = await loadConfig(workDir);
    expect(loaded.config.rules?.['high-complexity']).toEqual({ severity: 'enforced' });
  });

  it('loads a .js config (ESM)', async () => {
    const content = `export default { rules: { 'high-complexity': { severity: 'suggested' } } };\n`;
    writeFileSync(join(workDir, 'habit-hooks.config.js'), content);
    const loaded = await loadConfig(workDir);
    expect(loaded.config.rules?.['high-complexity']).toEqual({ severity: 'suggested' });
  });

  it('loads a .ts config via jiti', async () => {
    const content = `const config = { rules: { 'too-many-parameters': { severity: 'suggested' as const } } };\nexport default config;\n`;
    writeFileSync(join(workDir, 'habit-hooks.config.ts'), content);
    const loaded = await loadConfig(workDir);
    expect(loaded.config.rules?.['too-many-parameters']).toEqual({ severity: 'suggested' });
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
    const bad = { rules: { 'too-many-parameters': { severity: 'wrong' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /rules\.too-many-parameters\.severity must be 'enforced' or 'suggested'/,
    );
  });

  it('throws naming the field path on bad include type', async () => {
    const bad = { rules: { 'too-many-parameters': { include: 'src/**' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /rules\.too-many-parameters\.include must be an array of strings/,
    );
  });

  it('validates and round-trips the smells field', async () => {
    const cfg = { smells: { 'too-many-parameters': { severity: 'suggested', fix: 'shared/style.md' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(cfg));
    const loaded = await loadConfig(workDir);
    expect(loaded.config.smells?.['too-many-parameters']).toEqual({ severity: 'suggested', fix: 'shared/style.md' });
  });

  it('throws naming the smells field path on a bad severity', async () => {
    const bad = { smells: { 'too-many-parameters': { severity: 'wrong' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /smells\.too-many-parameters\.severity must be 'enforced' or 'suggested'/,
    );
  });

  it('throws when rules is not an object', async () => {
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify({ rules: [] }));
    await expect(loadConfig(workDir)).rejects.toThrow(/rules must be an object/);
  });

  it('throws when commentCheck is not an object', async () => {
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify({ commentCheck: 'nope' }));
    await expect(loadConfig(workDir)).rejects.toThrow(/commentCheck must be an object/);
  });

  it('throws when commentCheck.maxSingleLineChars is zero', async () => {
    const bad = { commentCheck: { maxSingleLineChars: 0 } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /commentCheck\.maxSingleLineChars must be a positive integer/,
    );
  });

  it('throws when commentCheck.maxSingleLineChars is negative', async () => {
    const bad = { commentCheck: { maxSingleLineChars: -3 } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /commentCheck\.maxSingleLineChars must be a positive integer/,
    );
  });

  it('throws when commentCheck.maxBlockChars is a float', async () => {
    const bad = { commentCheck: { maxBlockChars: 1.5 } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /commentCheck\.maxBlockChars must be a positive integer/,
    );
  });

  it('throws when commentCheck.maxBlockChars is not a number', async () => {
    const bad = { commentCheck: { maxBlockChars: 'twenty' } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /commentCheck\.maxBlockChars must be a positive integer/,
    );
  });

  it('round-trips a code-backed (use) sensor spec', async () => {
    const cfg = { sensors: { ruff: { use: 'ruff' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(cfg));
    const loaded = await loadConfig(workDir);
    expect(loaded.config.sensors?.ruff).toEqual({ use: 'ruff' });
  });

  it('round-trips a wrapper sensor spec', async () => {
    const cfg = { sensors: { mypy: { command: 'mypy ${files}', produces: ['type-error'], dependsOn: ['ruff'] } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(cfg));
    const loaded = await loadConfig(workDir);
    expect(loaded.config.sensors?.mypy).toEqual({
      command: 'mypy ${files}',
      produces: ['type-error'],
      dependsOn: ['ruff'],
    });
  });

  it('round-trips a declarative sensor spec with optional group and map', async () => {
    const cfg = {
      sensors: {
        eslint: {
          command: 'eslint -f json ${files}',
          produces: ['lint'],
          items: 'messages[]',
          fields: { smell: 'ruleId', line: 'line' },
          group: '[]',
          map: { 'no-unused-vars': 'unused-symbol' },
        },
      },
    };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(cfg));
    const loaded = await loadConfig(workDir);
    expect(loaded.config.sensors?.eslint).toEqual(cfg.sensors.eslint);
  });

  it('round-trips the files array', async () => {
    const cfg = { files: ['src/**/*.ts', 'lib/**/*.ts'] };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(cfg));
    const loaded = await loadConfig(workDir);
    expect(loaded.config.files).toEqual(['src/**/*.ts', 'lib/**/*.ts']);
  });

  it('throws when a use spec also sets command', async () => {
    const bad = { sensors: { ruff: { use: 'ruff', command: 'ruff ${files}' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /sensors\.ruff with 'use' must be the only key \('command' is not allowed\)/,
    );
  });

  it('throws when a command spec is missing produces', async () => {
    const bad = { sensors: { mypy: { command: 'mypy ${files}' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /sensors\.mypy\.produces must be a non-empty array of strings/,
    );
  });

  it('throws when a command spec has an empty produces', async () => {
    const bad = { sensors: { mypy: { command: 'mypy ${files}', produces: [] } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /sensors\.mypy\.produces must be a non-empty array of strings/,
    );
  });

  it('throws when a declarative spec has items but no fields', async () => {
    const bad = { sensors: { x: { command: 'x ${files}', produces: ['s'], items: '[]' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /sensors\.x\.fields must be an object of strings/,
    );
  });

  it('throws when a wrapper spec also sets items', async () => {
    const bad = { sensors: { x: { command: 'x ${files}', produces: ['s'], group: '[]' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /sensors\.x\.items must be a non-empty string/,
    );
  });

  it('throws when a sensor entry is not an object', async () => {
    const bad = { sensors: { x: 'nope' } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(/sensors\.x must be an object/);
  });

  it('throws when a sensor entry sets neither use nor command', async () => {
    const bad = { sensors: { x: { produces: ['s'] } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /sensors\.x must be set either 'use' or 'command'/,
    );
  });

  it('throws when a use spec is an empty string', async () => {
    const bad = { sensors: { x: { use: '' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /sensors\.x\.use must be a non-empty string/,
    );
  });

  it('throws when a use spec is not a string', async () => {
    const bad = { sensors: { x: { use: 5 } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /sensors\.x\.use must be a non-empty string/,
    );
  });

  it('throws when a command spec is an empty string', async () => {
    const bad = { sensors: { x: { command: '' } } };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /sensors\.x\.command must be a non-empty string/,
    );
  });

  it('throws when a declarative fields value is not a string', async () => {
    const bad = {
      sensors: { x: { command: 'x ${files}', produces: ['s'], items: '[]', fields: { smell: 5 } } },
    };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(
      /sensors\.x\.fields\.smell must be a string/,
    );
  });

  it('throws when files is not a string array', async () => {
    const bad = { files: 'src/**' };
    writeFileSync(join(workDir, 'habit-hooks.config.json'), JSON.stringify(bad));
    await expect(loadConfig(workDir)).rejects.toThrow(/files must be an array of strings/);
  });
});
