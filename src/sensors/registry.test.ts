import { describe, expect, it } from 'vitest';
import { defaultSensorIds, defaultSensorsFor } from './registry.js';

describe('defaultSensorsFor', () => {
  it('maps each typescript preset id to a use spec', () => {
    expect(defaultSensorsFor('typescript')).toEqual({
      eslint: { use: 'eslint' },
      comment: { use: 'comment' },
      jscpd: { use: 'jscpd' },
      knip: { use: 'knip' },
      'needs-extraction': { use: 'needs-extraction' },
    });
  });

  it('keeps its keys in lockstep with the runtime preset ids', () => {
    expect(Object.keys(defaultSensorsFor('typescript'))).toEqual(defaultSensorIds('typescript'));
    expect(Object.keys(defaultSensorsFor('python'))).toEqual(defaultSensorIds('python'));
  });

  it('returns an empty map for an unknown language', () => {
    expect(defaultSensorsFor('haskell')).toEqual({});
  });
});
