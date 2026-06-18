import type { DeclarativeSpec, SensorSpec, WrapperSensorSpec } from '../config/schema.js';
import { ADAPTER_KEYS } from '../config/validate-sensors.js';
import { declarativeSensor } from './adapter.js';
import { sensorFactory, type SensorFactoryInput } from './registry.js';
import { wrapperScriptSensor } from './wrapper-script.js';
import type { Sensor } from './types.js';

// Construct Sensor instances from validated SensorSpec config (issue #16). The
// mode discrimination mirrors the validator (validate-sensors.ts): `use` first,
// then adapter keys (items/fields) -> declarative, else wrapper script. A config
// that validated therefore always builds.

function isDeclarative(spec: WrapperSensorSpec | DeclarativeSpec): spec is DeclarativeSpec {
  return ADAPTER_KEYS.some((key) => key in spec);
}

function buildUse(use: string, input: SensorFactoryInput): Sensor {
  const factory = sensorFactory(use);
  if (factory === undefined) throw new Error(`unknown built-in sensor: "${use}"`);
  return factory(input);
}

function buildDeclarative(id: string, spec: DeclarativeSpec, input: SensorFactoryInput): Sensor {
  const sensor = declarativeSensor(
    { id, command: spec.command, produces: spec.produces, items: spec.items, fields: spec.fields, group: spec.group, map: spec.map },
    input.sink,
  );
  if (spec.dependsOn !== undefined) sensor.dependsOn = spec.dependsOn;
  return sensor;
}

function buildSensor(id: string, spec: SensorSpec, input: SensorFactoryInput): Sensor {
  if ('use' in spec) return buildUse(spec.use, input);
  if (isDeclarative(spec)) return buildDeclarative(id, spec, input);
  return wrapperScriptSensor(
    { id, produces: spec.produces, command: spec.command, dependsOn: spec.dependsOn },
    input.sink,
  );
}

export function buildSensors(specs: Record<string, SensorSpec>, input: SensorFactoryInput): Sensor[] {
  return Object.entries(specs).map(([id, spec]) => buildSensor(id, spec, input));
}
