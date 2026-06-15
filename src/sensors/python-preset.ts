import { jscpdWrap } from '../checks/jscpd-wrap.js';
import { declarativeSensor, type DeclarativeSensorSpec } from './adapter.js';
import { checkLeafSensor } from './preset.js';
import type { Sensor } from './types.js';

// The Python preset: ruff (declarative adapter) + jscpd on .py + deptry
// (declarative adapter). Ruff/deptry rule -> smell maps follow
// docs/smell-vocabulary.md "Python smell mapping"; ruff F401 adds the general
// `unused-import` smell (agent decision, see DECISIONS.md).
const RUFF_SPEC: DeclarativeSensorSpec = {
  id: 'ruff',
  produces: ['high-complexity', 'too-many-parameters', 'oversized-function', 'unused-variable', 'unused-import'],
  command: 'ruff check --output-format=json --select=C901,PLR0913,PLR0915,F841,F401 ${files}',
  items: '[]',
  fields: { smell: 'code', file: 'filename', line: 'location.row', column: 'location.column', message: 'message' },
  map: {
    C901: 'high-complexity',
    PLR0913: 'too-many-parameters',
    PLR0915: 'oversized-function',
    F841: 'unused-variable',
    F401: 'unused-import',
  },
};

// deptry analyses the whole project and emits a flat JSON array to /dev/stdout.
const DEPTRY_SPEC: DeclarativeSensorSpec = {
  id: 'deptry',
  produces: ['unused-dependency'],
  command: 'deptry . --json-output /dev/stdout',
  items: '[]',
  fields: { smell: 'error.code', file: 'location.file', line: 'location.line', message: 'error.message' },
  map: { DEP002: 'unused-dependency' },
};

export interface PythonPresetInput {
  notices: string[];
}

export function buildPythonPresetSensors(input: PythonPresetInput): Sensor[] {
  const { notices } = input;
  return [
    declarativeSensor(RUFF_SPEC, notices),
    checkLeafSensor({ check: jscpdWrap, produces: ['duplicated-code'], notices }),
    declarativeSensor(DEPTRY_SPEC, notices),
  ];
}
