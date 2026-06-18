import { describe, expect, it } from 'vitest';
import { buildSensors } from './build-sensors.js';
import { ESLINT_PRODUCES } from '../config/tool-smells.js';
import type { SensorFactoryInput } from './registry.js';
import type { SensorSpec } from '../config/schema.js';

function input(): SensorFactoryInput {
  return { sink: { notices: [], failures: [] }, cwd: '/tmp', rulesById: new Map() };
}

describe('buildSensors', () => {
  it('builds a use-mode sensor from the built-in factory', () => {
    const sensors = buildSensors({ eslint: { use: 'eslint' } }, input());
    expect(sensors).toHaveLength(1);
    expect(sensors[0]?.produces).toEqual(ESLINT_PRODUCES);
  });

  it('throws on an unknown use reference', () => {
    expect(() => buildSensors({ x: { use: 'nope' } }, input())).toThrow(/unknown built-in sensor: "nope"/);
  });

  it('builds a declarative sensor with the record key as id, plus produces and dependsOn', () => {
    const spec: SensorSpec = {
      command: 'mytool ${files}',
      produces: ['my-smell'],
      items: '[]',
      fields: { smell: 'code' },
      dependsOn: ['oversized-file'],
    };
    const sensors = buildSensors({ mine: spec }, input());
    expect(sensors[0]?.id).toBe('mine');
    expect(sensors[0]?.produces).toEqual(['my-smell']);
    expect(sensors[0]?.dependsOn).toEqual(['oversized-file']);
  });

  it('routes to declarative via a shared adapter key (group) even without items/fields', () => {
    const spec = {
      command: 'mytool ${files}',
      produces: ['my-smell'],
      group: 'file',
    } as unknown as SensorSpec;
    const sensors = buildSensors({ grouped: spec }, input());
    expect(sensors[0]?.id).toBe('grouped');
    expect(sensors[0]?.produces).toEqual(['my-smell']);
  });

  it('builds a wrapper sensor with the record key as id, plus produces and dependsOn', () => {
    const spec: SensorSpec = {
      command: 'mytool ${files}',
      produces: ['my-smell'],
      dependsOn: ['duplicated-code'],
    };
    const sensors = buildSensors({ wrapped: spec }, input());
    expect(sensors[0]?.id).toBe('wrapped');
    expect(sensors[0]?.produces).toEqual(['my-smell']);
    expect(sensors[0]?.dependsOn).toEqual(['duplicated-code']);
  });
});
