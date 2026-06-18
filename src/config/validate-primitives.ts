export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function fail(path: string, expected: string): never {
  throw new Error(`Invalid habit-hooks config: ${path} must be ${expected}`);
}

export function validateOptionalString(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'string') fail(path, 'a string');
}

export function validateOptionalStringArray(value: unknown, path: string): void {
  if (value === undefined) return;
  if (!isStringArray(value)) fail(path, 'an array of strings');
}
