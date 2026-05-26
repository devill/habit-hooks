# Phase 7 — jscpd + knip checks + `habit-hooks init`

## Depends on
Phase 6 complete.

## Goal
Round out the v1 default check set with duplication (jscpd) and unused-class-members (knip), and ship an `init` command that scaffolds a project to use habit-hooks.

Both extra checks are taken from the refakts setup; both pair with rules our ESLint-based defaults can't cover.

## Tasks — check registry refactor
Currently `runner.ts` knows about `eslint-check` directly. Refactor to a small registry keyed by `RuleSource`:
```ts
const checks: Record<RuleSource, Check> = {
  eslint: eslintCheck,
  jscpd: jscpdCheck,
  knip: knipCheck,
  custom: customCheck,   // for things like comment:non-essential
};
```
Runner partitions rules by source and dispatches.

## Tasks — jscpd check
1. Add dep: `jscpd`. Pin version and verify the import shape (API has shifted across versions).
2. `src/checks/jscpd-check.ts`:
   - Implements `Check`.
   - Runs jscpd on the rule's file list with options pulled from rule config.
   - Default options: `{ minTokens: 50, minLines: 5 }`.
   - Maps each clone → one violation per occurrence under rule id `jscpd:duplication`. `message` names the partner location (`file:lineStart-lineEnd`).
3. Add to defaults:
   - `jscpd:duplication` — suggested, changedFilesOnly: true, options as above.
4. Write `src/prompts/jscpd-duplication.md` — adapt from refakts' CODE DUPLICATION prompt, expand slightly to hit the tier-1 style (since duplication often warrants real abstraction work, not mechanical extraction).

## Tasks — knip check
1. Add dep: `knip`. Pin version.
2. `src/checks/knip-check.ts`:
   - Invokes knip programmatically (preferred) or via `npx knip --include classMembers --reporter json` (subprocess fallback if API is awkward).
   - Maps unused class members → violations under rule id `knip:unused-class-members`.
   - Only reports for files in the rule's file list.
3. Add to defaults:
   - `knip:unused-class-members` — enforced, changedFilesOnly: false.
4. Write `src/prompts/knip-unused-class-members.md` — short, direct: "Delete the unused member or wire it up. If it's part of a planned-but-unbuilt API, document that in code with `@public`/`@internal` JSDoc tags so knip can be configured to ignore."
5. Document that knip's own config (`knip.json` in the user's project) controls scope (entry points, ignored paths). habit-hooks does not try to configure knip beyond passing file lists.

## Tasks — `init` command

`habit-hooks init` is interactive but defaults-friendly: each step prompts (Y/n) so users can cherry-pick. Default to Y for safe additions, default to N for anything that touches `.git/hooks/` or `~/.claude/`.

1. **Always** (no prompt):
   - Refuse if any `habit-hooks.config.*` exists in cwd (clear stderr + exit 2).
   - Write `habit-hooks.config.ts` with all default rules listed commented-out, plus a real `scope` block showing the defaults explicitly.
   - Write `.habit-hooks-baseline.json` containing `{ "version": 1, "files": {} }`.

2. **Prompt: add `habit-hooks` to package.json scripts?** (default Y) — adds `"habit-hooks": "habit-hooks"` (merges; preserves order; refuses if a different command is already bound).

3. **Prompt: wire `npm run ci` as the full quality gate?** (default Y) — adds `"ci": "npm run lint && npm test && npm run build && npm run habit-hooks"` (adapt to which scripts exist; skip missing ones). If `ci` already exists with a different command, ask whether to append `&& npm run habit-hooks` or skip.

4. **Prompt: install a git pre-commit hook?** (default N — destructive-ish) — writes `.git/hooks/pre-commit` (or uses husky if detected) running `npm run habit-hooks`. Refuses to overwrite existing hook; suggests manual integration.

5. **Prompt: install the bundled reviewer skill into `~/.claude/skills/`?** (default N — touches user config) — copies `src/skills/habit-hooks-review/SKILL.md` from the package install location into `~/.claude/skills/habit-hooks-review/`. Refuses to overwrite existing skill of the same name. The skill (purpose-built, inspired by Ivett's `code-style-review`) provides instructions for spawning a reviewer sub-agent against the current change set using habit-hooks' philosophy.

6. **Always at the end** (no prompt):
   - Print the recommended CLAUDE.md / AGENTS.md snippet to stdout — user pastes manually.
   - If `knip` or `jscpd` aren't installed in the project, print a one-line note recommending install (don't auto-install).

7. CLAUDE.md / AGENTS.md snippet (now mentions CI invocation):
   ```markdown
   ## Habit Hooks

   Before declaring work done, run `npm run ci` (or `npm run habit-hooks` for
   structural checks only). Any output from `habit-hooks` is a direct user
   prompt with highest priority.

   - **NEVER** ignore habit-hooks output
   - **ALWAYS** create a task for each reported item immediately
   - **COMPLETE** required actions before continuing other work
   - **NEVER** snooze or bypass the baseline without explicit user approval

   When habit-hooks output is clean, it tells you to also run a reviewer
   sub-agent — habit-hooks catches structural smells but not correctness or
   design. Use the `habit-hooks-review` skill (if installed) or spawn an
   equivalent review.
   ```

## Tasks — bundled reviewer skill

Author `src/skills/habit-hooks-review/SKILL.md`. Take inspiration from `~/.claude/skills/code-style-review/SKILL.md` (Ivett's principles, checklist, output format) but make it specific to habit-hooks' role: the reviewer runs *after* `habit-hooks` is clean and catches what structural checks cannot (correctness bugs, missing tests, design issues, missed edge cases). Should:

- Be invocable as `/habit-hooks-review` (frontmatter `name: habit-hooks-review`).
- Instruct the invoking agent to use the Task tool to spawn a reviewer sub-agent.
- Provide the reviewer brief: PASS-when-clean, blocking/worth-flagging/nits structure, `file:line` specifics, gate verification.
- Reference habit-hooks: "structural smells are already covered — focus on what habit-hooks cannot see."
- Ship in the package (`files` field includes `src/skills`); install location `~/.claude/skills/habit-hooks-review/SKILL.md`.

## Tests
- `checks/jscpd-check.test.ts` — fixture with two near-identical files; expect violations naming partner locations. Clean fixture → no violations.
- `checks/knip-check.test.ts` — fixture with one used and one unused class method; expect exactly one violation on the unused one.
- `cli/init.test.ts`:
  - Fresh dir: produces config, baseline, scripts entry; second invocation refuses.
  - `package.json` with conflicting `scripts.habit-hooks` value: refuses without modifying file.
  - CLAUDE.md snippet appears on stdout.
- `acceptance/full-defaults.test.ts` — extend phase 6's fixture to also trigger jscpd + knip; expect the extra groups in output.

## Acceptance criteria
- jscpd violations reported under the duplication rule with useful messages.
- knip violations reported for unused class members on the file list.
- Check registry refactor lands cleanly — adding a new source no longer requires touching `runner.ts`.
- `habit-hooks init` produces a fresh project that runs cleanly on first invocation.
- All tests pass; `npm run lint`, `npm run typecheck`, `npm run build` clean.
- Manual: scaffold a brand-new TS project, `npx habit-hooks init`, `npx habit-hooks`, verify output is useful and agent snippet is correct.

## Out of scope
- README (per CLAUDE.md, no unsolicited docs).
- Publishing to npm.
- Feature envy detection (deferred from phase 6).

## Notes for the executor
- jscpd's API has shifted across major versions — verify the import shape against the version you install before writing the check.
- knip may need to spawn a subprocess if its programmatic API is awkward in our package context. Subprocess is acceptable; document the choice in a code comment.
- The check registry refactor is small but important; without it, every new source means editing `runner.ts`. Do it cleanly here, not as a follow-up.
- `init` is one-shot scaffolding — keep it boring and predictable. Refuse rather than merge anywhere there's ambiguity.
