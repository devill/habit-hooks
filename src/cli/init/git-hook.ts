import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectPackageManager, runScriptCommand } from './install-commands.js';
import type { Language } from '../../config/schema.js';

export type HookAction = 'installed' | 'conflict' | 'no-git' | 'kept';

export interface HookResult {
  action: HookAction;
  path?: string;
}

function hookCommandFor(cwd: string, language: Language): string {
  if (language === 'python') return 'habit-hooks';
  return runScriptCommand(detectPackageManager(cwd), 'habit-hooks');
}

function hookBodyFor(cwd: string, language: Language): string {
  return `#!/usr/bin/env sh\n${hookCommandFor(cwd, language)}\n`;
}

function dependsOnHusky(cwd: string): boolean {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return false;
  if (!existsSync(join(cwd, '.husky'))) return false;
  const raw = readFileSync(pkgPath, 'utf8');
  return raw.includes('"husky"');
}

function huskyHookPath(cwd: string): string {
  return join(cwd, '.husky', 'pre-commit');
}

function nativeHookPath(cwd: string): string {
  return join(cwd, '.git', 'hooks', 'pre-commit');
}

function writeHook(path: string, body: string): HookResult {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
  return { action: 'installed', path };
}

function bodyMatches(content: string): boolean {
  return /(^|\s)habit-hooks(\s|$)/m.test(content);
}

function installAt(path: string, body: string): HookResult {
  if (existsSync(path)) {
    const existing = readFileSync(path, 'utf8');
    if (bodyMatches(existing)) return { action: 'kept', path };
    return { action: 'conflict', path };
  }
  return writeHook(path, body);
}

export function installPreCommitHook(cwd: string, language: Language): HookResult {
  const body = hookBodyFor(cwd, language);
  if (dependsOnHusky(cwd)) return installAt(huskyHookPath(cwd), body);
  if (!existsSync(join(cwd, '.git'))) return { action: 'no-git' };
  return installAt(nativeHookPath(cwd), body);
}
