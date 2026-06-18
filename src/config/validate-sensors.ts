import type { HabitHooksConfig, SensorSpec } from './schema.js';
import {
  fail,
  isPlainObject,
  isStringArray,
  validateOptionalString,
  validateOptionalStringArray,
} from './validate-primitives.js';

// A sensor spec (issue #16) is discriminated by which key it sets: `use` is a
// code-backed factory reference; otherwise `command` is required and the
// presence of any adapter key (items/fields/group/map) makes it declarative,
// else a wrapper script. The modes are mutually exclusive.

export const ADAPTER_KEYS = ['items', 'fields', 'group', 'map'] as const;
const USE_FORBIDDEN_KEYS = ['command', 'produces', 'dependsOn', ...ADAPTER_KEYS] as const;

function validateNonEmptyString(value: unknown, path: string): void {
  if (typeof value !== 'string' || value.length === 0) fail(path, 'a non-empty string');
}

function validateNonEmptyStringArray(value: unknown, path: string): void {
  if (!isStringArray(value) || value.length === 0) fail(path, 'a non-empty array of strings');
}

function validateStringRecord(value: unknown, path: string): void {
  if (!isPlainObject(value)) fail(path, 'an object of strings');
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') fail(`${path}.${key}`, 'a string');
  }
}

function validateUseSensor(entry: Record<string, unknown>, base: string): void {
  validateNonEmptyString(entry.use, `${base}.use`);
  for (const key of USE_FORBIDDEN_KEYS) {
    if (key in entry) fail(`${base} with 'use'`, `the only key ('${key}' is not allowed)`);
  }
}

function validateDeclarativeSensor(entry: Record<string, unknown>, base: string): void {
  validateNonEmptyString(entry.items, `${base}.items`);
  validateStringRecord(entry.fields, `${base}.fields`);
  validateOptionalString(entry.group, `${base}.group`);
  if (entry.map !== undefined) validateStringRecord(entry.map, `${base}.map`);
}

function validateCommandSensor(entry: Record<string, unknown>, base: string): void {
  validateNonEmptyString(entry.command, `${base}.command`);
  validateNonEmptyStringArray(entry.produces, `${base}.produces`);
  validateOptionalStringArray(entry.dependsOn, `${base}.dependsOn`);
  if (ADAPTER_KEYS.some((key) => key in entry)) validateDeclarativeSensor(entry, base);
}

function validateSensorSpec(value: unknown, base: string): SensorSpec {
  if (!isPlainObject(value)) fail(base, 'an object');
  if ('use' in value) validateUseSensor(value, base);
  else if ('command' in value) validateCommandSensor(value, base);
  else fail(base, `set either 'use' or 'command'`);
  return value as unknown as SensorSpec;
}

export function validateSensors(value: unknown): HabitHooksConfig['sensors'] {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) fail('sensors', 'an object keyed by sensor id');
  const result: Record<string, SensorSpec> = {};
  for (const [id, spec] of Object.entries(value)) {
    result[id] = validateSensorSpec(spec, `sensors.${id}`);
  }
  return result;
}

export function validateFiles(value: unknown): string[] | undefined {
  validateOptionalStringArray(value, 'files');
  return value as string[] | undefined;
}
