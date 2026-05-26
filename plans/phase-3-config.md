# Phase 3 — Configuration loading

## Depends on
Phase 2 complete.

## Goal
Replace the hard-coded rule registry with a config-driven one. Support `habit-hooks.config.{ts,js,mjs,json}` in the project root, plus a `prompts` directory override for per-rule guidance.

## Config shape (`src/config/schema.ts`)
```ts
export interface RuleOverride {
  severity?: Severity;
  changedFilesOnly?: boolean;
  eslintOptions?: unknown;
  title?: string;
  description?: string;
  disabled?: boolean;
  include?: string[];   // glob patterns; if set, rule only runs on matching files
  exclude?: string[];   // glob patterns; rule skips matching files
}

export interface RuleDefinition extends RuleOverride {
  id: string;
  source: RuleSource;
  sourceRuleId?: string;
}

export interface HabitHooksConfig {
  prompts?: string;                              // dir, relative to config file
  rules?: Record<string, RuleOverride | RuleDefinition>;  // keyed by rule id
  scope?: {
    onlyChangedFiles?: boolean;
    autoBranchOffMain?: boolean;
    branchBase?: string;                         // default 'origin/main'
    mainBranch?: string;                         // default 'main'
  };
}
```
Key-by-id keeps merging simple. If the key's record includes `source`, it's a new rule; otherwise it's an override of a built-in.

## Tasks
1. Add deps: `jiti` (for `.ts` loading).
2. `src/config/schema.ts` — types above.
3. `src/config/defaults.ts` — exports `defaultConfig: HabitHooksConfig` and `defaultRules: Rule[]` (move the hard-coded set from phase 2 here).
4. `src/config/load.ts`:
   - `loadConfig(cwd: string): Promise<{ config: HabitHooksConfig; sourcePath: string | null }>`.
   - Look for `habit-hooks.config.ts|mjs|js|json` in `cwd` (first hit wins, in that order). No upward walk.
   - `.json` → `JSON.parse(fs.readFileSync)`.
   - `.ts` → `jiti` (cached, `interopDefault: true`).
   - `.mjs`/`.js` → dynamic `import()` with `pathToFileURL`.
   - Validate shape at runtime (handwritten guards; do not add zod). On invalid input throw a clear error naming the offending field.
5. `src/config/merge.ts`:
   - `mergeRules(defaultRules: Rule[], overrides: HabitHooksConfig['rules']): Rule[]`.
   - For each default rule: apply override fields if present. Drop if `disabled: true`.
   - Append user-defined rules (those with `source`) at end of registry.
6. `src/prompts/loader.ts` — extend signature to `loadGuidance(ruleId: string, opts: { overrideDir?: string; packagedDir: string }): string`:
   - Try `<overrideDir>/<slug>.md` first if `overrideDir` set.
   - Fall back to `<packagedDir>/<slug>.md`.
   - Throw with both attempted paths if neither exists.
7. `src/rules/registry.ts`:
   - Replace `getRules()` with `buildRules(config: HabitHooksConfig, configDir: string): Rule[]`.
   - Resolves `config.prompts` against `configDir` to an absolute path.
   - Calls `mergeRules` then attaches resolved guidance via loader.
8. Runner: when computing each rule's effective file list, apply `include`/`exclude` globs (using `picomatch` or `fast-glob`'s matcher). `include` empty/undefined ⇒ no narrowing; `exclude` empty/undefined ⇒ no removal.
9. Update `defaultConfig` so `max-lines-per-function` ships with `exclude: ['**/*.test.ts', '**/*.spec.ts', 'tests/**']`. Tests organized as `describe`+`it` blocks naturally exceed any sane function-size threshold; that's not the rule's intent. (Surfaced during phase 2 dogfooding.)
8. `src/runner.ts`:
   - Now: load config from cwd, build rules, run checks, report.
   - When no config file present: use `defaultConfig`, log nothing.
   - When config is malformed: print error to stderr, exit 2 (distinct from violation exit 1).
9. `src/cli.ts` — add `--config <path>` flag for explicit config file (handy for tests).

## Tests
- `config/load.test.ts` — fixtures for each of the four formats; verify loaded shape.
- `config/load.test.ts` — missing config → returns defaults; malformed → throws with field name.
- `config/merge.test.ts` — override severity, override eslintOptions, disable a rule, add a custom rule, add `include`/`exclude` patterns.
- `prompts/loader.test.ts` — override dir hit; fallback to packaged; both-missing error contains both paths.
- `runner.test.ts` — end-to-end with a fixture project that ships its own `habit-hooks.config.ts` + custom prompt file.
- `runner.test.ts` — rule-level `exclude` filters test files out of `max-lines-per-function` while still running on `src/`.

## Acceptance criteria
- All four config formats load and produce identical merged rule sets given equivalent input.
- Per-rule prompt override resolves correctly; missing override falls back silently.
- `disabled: true` removes a rule from the registry (no violations reported for it).
- Tests pass; lint/typecheck/build clean.

## Out of scope
- Acting on `scope` config (phase 4).
- Baseline.
- jscpd.

## Notes for the executor
- Keep validation manual — handwritten guards are cheaper than pulling zod.
- `jiti` is the smallest TS-loader option that works without ESM/CJS pain. Don't reach for `tsx` or `ts-node` for this.
