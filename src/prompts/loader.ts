import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function slugify(ruleId: string): string {
  return ruleId.replace(/:/g, '-');
}

function resolvePackagedDir(): string {
  // When compiled, `here` is .../dist/prompts and the source markdown lives at
  // .../src/prompts. When running tests via vitest, `here` is .../src/prompts
  // and the files sit alongside this loader.
  if (existsSync(join(here, 'eslint-max-params.md'))) return here;
  return join(here, '..', '..', 'src', 'prompts');
}

function tryRead(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8').trimEnd() : null;
}

function missingError(ruleId: string, attempts: string[]): Error {
  const lines = attempts.map((p) => `  - ${p}`).join('\n');
  return new Error(`No guidance found for rule "${ruleId}". Tried:\n${lines}`);
}

export interface LoadGuidanceOptions {
  overrideDir?: string;
  packagedDir?: string;
}

function candidatePaths(slug: string, opts: LoadGuidanceOptions): string[] {
  const packagedDir = opts.packagedDir ?? resolvePackagedDir();
  const paths: string[] = [];
  if (opts.overrideDir !== undefined) paths.push(join(opts.overrideDir, `${slug}.md`));
  paths.push(join(packagedDir, `${slug}.md`));
  return paths;
}

export function loadGuidance(ruleId: string, opts: LoadGuidanceOptions = {}): string {
  const attempts = candidatePaths(slugify(ruleId), opts);
  for (const path of attempts) {
    const text = tryRead(path);
    if (text !== null) return text;
  }
  throw missingError(ruleId, attempts);
}
