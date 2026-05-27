import { isAbsolute, join } from 'node:path';
import type { ShellResult } from './shell.js';
import type { CheckOutcome } from '../types.js';

export interface BinResolution {
  binPath: string;
  isFallback: boolean;
}

export function fallbackNotice(tool: string, cwd: string): string {
  return `habit-hooks: using bundled ${tool} (no ${tool} installation found in ${cwd})`;
}

export function spawnFailureWarning(tool: string, cwd: string, warnings: string[]): string {
  const detail = warnings.length > 0 ? warnings.join('; ') : 'spawn failure';
  return `habit-hooks: ${tool} skipped in ${cwd} (${detail})`;
}

export function firstLine(text: string): string {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return '';
}

export function isSpawnFailure(result: ShellResult): boolean {
  return result.exitCode === -1;
}

export function emptyOutcome(stderr: string[]): CheckOutcome {
  return { violations: [], stderr };
}

export function noticesFor(tool: string, resolution: BinResolution, cwd: string): string[] {
  return resolution.isFallback ? [fallbackNotice(tool, cwd)] : [];
}

export function absolutize(cwd: string, file: string): string {
  return isAbsolute(file) ? file : join(cwd, file);
}
