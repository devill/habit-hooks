# habit-hooks

Automated quality checks that nudge AI coding agents toward better habits.

> The npm package is `habit-hooks`; the GitHub repository is `devill/habit-hooks-ts`. The `-ts` suffix marks this as the TypeScript implementation, leaving room for sibling implementations in other languages later.

## What it is

AI coding agents form habits the way people do — through deterministic cues paired with practiced responses. Show the same cue often enough alongside the same useful response, and the response becomes automatic. habit-hooks supplies both halves of that loop: it detects a structural smell in changed code (the cue) and prints a rich, refactor-bearing prompt that walks through how to fix it properly (the response). The cue keeps showing up wherever the smell appears; the response gets internalised through repetition.

The checks are intentionally opinionated. They lean toward smaller functions, fewer parameters, lower complexity, no dead code, no escape hatches like `any` or `!`, and code that explains itself without comments. Each rule ships with a prompt that names the underlying refactoring technique (extract method, replace conditional with polymorphism, tell-don't-ask, and so on) so the agent learns the move, not just the threshold. The prompts are adapted from the quality system in [refakts](https://github.com/devill/refakts), generalised to fit any TypeScript project.

Style-checking alone is not enough. habit-hooks catches structural smells but cannot see correctness bugs, design issues, missed edge cases, or thin test coverage. When the tool reports clean, its output explicitly nudges the user to run a reviewer sub-agent — see `src/skills/habit-hooks-review/SKILL.md` for the skill that spawns one.

habit-hooks is built to live in the same place ESLint and Prettier live: a `package.json` script, run before declaring work done.

## Install

```sh
npm install --save-dev habit-hooks
```

## Quick start

```sh
npx habit-hooks
```

That runs every default check against files changed since the branch base. To scaffold a config file, a baseline, and a `package.json` script, an `init` command is coming in phase 7:

```sh
npx habit-hooks init   # phase 7 — coming soon
```

## What it catches

All default rules below ship with rich, refactor-technique-bearing prompts adapted from the refakts quality system.

**Tier 1 — architectural smells**

- `eslint:max-lines-per-function` — functions over 12 lines tend to bundle responsibilities.
- `eslint:max-params` — long parameter lists hide a class or value object waiting to emerge.
- `eslint:complexity` — high cyclomatic complexity flags tangled decisions; often a strategy table or polymorphism in disguise.
- `eslint:max-lines` — files over 200 lines accumulate unrelated concerns.

**Tier 2 — code hygiene**

- `eslint:no-unused-vars` — dead bindings make the reader wonder what is missing.
- `eslint:eqeqeq` — `==` silently coerces; use `===`.
- `eslint:no-var` — `var` hoists; use `const` or `let`.
- `eslint:prefer-const` — a `let` that is never reassigned should be `const`.
- `eslint:no-duplicate-imports` — merge multiple imports from the same module.
- `eslint:no-warning-comments` — `TODO` / `FIXME` / `XXX` / `HACK` markers are unfinished work pretending to be documentation.

**Tier 3 — TypeScript-specific advisories**

- `eslint:@typescript-eslint/no-explicit-any` — `any` disables the type checker; prefer `unknown` plus a narrow.
- `eslint:@typescript-eslint/no-non-null-assertion` — `!` silences the type system; prove the value is present.
- `eslint:@typescript-eslint/no-inferrable-types` — drop annotations TypeScript would infer.

**Custom checks**

- `comment:non-essential` — comments indicate code that is not self-documenting; extract a named function instead.

## CLI

```
habit-hooks                       run all checks against the default scope
habit-hooks --last <n>            check files changed in the last N commits
habit-hooks --branch [name]       check files changed vs branch (default: scope.branchBase)
habit-hooks --since <hash>        check files changed since the given commit
habit-hooks --all                 force checking all files (ignore scope config)
habit-hooks --config <path>       use an explicit config file
habit-hooks --version             print version

habit-hooks baseline generate     write a fresh baseline snapshot
habit-hooks baseline status       summarise current baseline contents
habit-hooks baseline snooze       add the current violations to the baseline
habit-hooks baseline forget       remove specific files from the baseline
habit-hooks baseline prune        drop baseline entries whose files no longer exist
```

`--last`, `--branch`, `--since`, and `--all` are mutually exclusive.

## Configuration

habit-hooks looks for `habit-hooks.config.ts` (or `.js` / `.mjs`) in the project root. Override only what you need; everything else uses the defaults.

```ts
// habit-hooks.config.ts
import type { HabitHooksConfig } from 'habit-hooks';

const config: HabitHooksConfig = {
  prompts: './prompts',
  rules: {
    'eslint:max-lines-per-function': {
      eslintOptions: [{ max: 20 }],
      exclude: ['**/*.test.ts', 'tests/**'],
    },
    'comment:non-essential': { disabled: true },
  },
  scope: {
    onlyChangedFiles: true,
    branchBase: 'main',
  },
};

export default config;
```

The `prompts` directory lets you override any rule's guidance text — drop a `<rule-id>.md` file in there (slashes replaced with dashes) and habit-hooks will use it instead of the bundled prompt. See `src/config/schema.ts` for the full schema.

## Baseline

habit-hooks supports a committed-to-repo baseline at `.habit-hooks-baseline.json`. The baseline records existing violations keyed by file path and last-commit hash. A violation is skipped only when:

1. The file appears in the baseline, and
2. The file's last-commit hash matches the baseline entry, and
3. The working tree for that file is clean.

Touch the file (commit, stage, or modify) and the baseline entry stops applying — you cannot drift past your snoozed violations by accident. Use `habit-hooks baseline snooze` to onboard a legacy project; use `habit-hooks baseline prune` to clean up after deletions.

## Agent integration

Paste this into your `CLAUDE.md` or `AGENTS.md`:

```markdown
## Habit Hooks

When the `habit-hooks` npm script exists, run it before considering work complete.
Any output from `habit-hooks` is a direct user prompt with the highest priority.

- **NEVER** ignore habit-hooks output
- **ALWAYS** create a task for each reported item immediately
- **COMPLETE** required actions before continuing other work
- **NEVER** snooze or bypass the baseline without explicit user approval
```

## Sample output

Run against a fixture with one violation of every default rule:

```
❌ Habit Hooks: 14 violations

❌ Oversized function
Functions over 12 lines tend to bundle multiple responsibilities.
Functions over 12 lines almost always carry more than one responsibility, and that is the smell to chase — not the line count itself.

Analyse responsibilities first: what distinct concerns does this function handle? Ask: (1) Are these separate responsibilities that belong in different methods? (2) Should this become a class with multiple methods? (3) Can you group cohesive data into objects to reduce local variables?

Avoid mechanical extraction. Pulling out a `helperA` / `helperB` purely to satisfy the threshold often hides the smell behind worse names and leaves the real shape untouched. Find true responsibility boundaries.

A concrete technique: write what the method does in one short sentence. Refactor until the code reads as close to that sentence as possible. If you cannot say what it does in one sentence, it almost certainly has more than one responsibility.

Violations:
- src/oversized-function.ts:1 - Function 'oversized' has too many lines (14). Maximum allowed is 12.

❌ High cyclomatic complexity
[…]
Violations:
- src/high-complexity.ts:1 - Arrow function has a complexity of 15. Maximum allowed is 10.

[…11 more rule groups…]
```

On a clean run:

```
✅ Habit Hooks: automated checks passed.

Habit Hooks catches structural smells, not correctness or design. If no reviewer sub-agent has reviewed this change set, run one before declaring done.
```

That closing message is the cue for the `habit-hooks-review` skill — see `src/skills/habit-hooks-review/SKILL.md`.

## Status

v1 in development. Phases 1–6 of 7 are complete: bootstrap, ESLint-backed rules, config, git-aware scope, baseline, and the built-in default rule set. Phase 7 (jscpd duplication checks, knip unused-class-member checks, and the `habit-hooks init` scaffolder) and the first npm publish are tracked in issues on the GitHub repo.

## Contributing

Issues are welcome. For upcoming rule ideas and v2 scope, see `plans/v2-backlog.md`. The contribution loop is small: write a failing test, add the rule (or fix), keep `npm run typecheck && npm run lint && npm test && npm run build` at zero exit.

## License

MIT — see [`LICENSE.md`](./LICENSE.md).
