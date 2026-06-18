import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wrapperScriptSensor } from './wrapper-script.js';
import type { SensorSink } from '../wrap/notices.js';

function emptySink(): SensorSink {
  return { notices: [], failures: [] };
}

// buildArgv splits the command on whitespace, so the script path must be
// space-free — mkdtemp under tmpdir gives a space-free path on every platform.
function writeScript(dir: string, body: string): string {
  const path = join(dir, 'wrapper.cjs');
  writeFileSync(path, body);
  return path;
}

describe('wrapperScriptSensor', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hh-wrap-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('parses bag JSON from the command and returns the issues', async () => {
    const script = writeScript(
      dir,
      `console.log(JSON.stringify({ issues: [{ smell: 'my-smell', details: { file: 'x', message: 'm' } }] }));`,
    );
    const sensor = wrapperScriptSensor({ id: 'wrap', produces: ['my-smell'], command: `node ${script}` }, emptySink());

    const issues = await sensor.run({ files: [join(dir, 'a.ts')], cwd: dir, deps: [] });

    expect(issues).toEqual([{ smell: 'my-smell', details: { file: 'x', message: 'm' } }]);
  });

  it('returns [] for empty or garbage stdout without recording a failure', async () => {
    const sink = emptySink();
    const script = writeScript(dir, `console.log('not json at all');`);
    const sensor = wrapperScriptSensor({ id: 'wrap', produces: ['s'], command: `node ${script}` }, sink);

    const issues = await sensor.run({ files: [join(dir, 'a.ts')], cwd: dir, deps: [] });

    expect(issues).toEqual([]);
    expect(sink.failures).toEqual([]);
  });

  it('returns [] when bag entries are malformed (missing smell/details)', async () => {
    const script = writeScript(
      dir,
      `console.log(JSON.stringify({ issues: [{ smell: 1 }, { details: {} }, 'nope'] }));`,
    );
    const sensor = wrapperScriptSensor({ id: 'wrap', produces: ['s'], command: `node ${script}` }, emptySink());

    const issues = await sensor.run({ files: [join(dir, 'a.ts')], cwd: dir, deps: [] });

    expect(issues).toEqual([]);
  });

  it('drops an issue whose details is an array', async () => {
    const script = writeScript(
      dir,
      `console.log(JSON.stringify({ issues: [{ smell: 'my-smell', details: [] }] }));`,
    );
    const sensor = wrapperScriptSensor({ id: 'wrap', produces: ['my-smell'], command: `node ${script}` }, emptySink());

    const issues = await sensor.run({ files: [join(dir, 'a.ts')], cwd: dir, deps: [] });

    expect(issues).toEqual([]);
  });

  it('records a failure and a notice (zero issues) when the command cannot spawn', async () => {
    const sink = emptySink();
    const sensor = wrapperScriptSensor({ id: 'wrap', produces: ['s'], command: '/nonexistent-xyz-bin' }, sink);

    const issues = await sensor.run({ files: [join(dir, 'a.ts')], cwd: dir, deps: [] });

    expect(issues).toEqual([]);
    expect(sink.failures).toHaveLength(1);
    expect(sink.failures[0]).toContain('wrap');
    expect(sink.notices).toContain(sink.failures[0]);
  });

  it('returns [] without running the command when files is empty', async () => {
    const sink = emptySink();
    const sensor = wrapperScriptSensor({ id: 'wrap', produces: ['s'], command: '/nonexistent-xyz-bin' }, sink);

    const issues = await sensor.run({ files: [], cwd: dir, deps: [] });

    expect(issues).toEqual([]);
    expect(sink.failures).toEqual([]);
  });

  it('attaches dependsOn when provided', () => {
    const sensor = wrapperScriptSensor(
      { id: 'wrap', produces: ['s'], command: 'noop', dependsOn: ['oversized-file'] },
      emptySink(),
    );
    expect(sensor.dependsOn).toEqual(['oversized-file']);
  });
});
