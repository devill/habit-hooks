# Build habit-hooks end-to-end (overnight, unsupervised)

A **Workflows** spec. Hand this to the Workflow tool; Claude writes the JS
orchestration. It builds the whole `simplified` rebuild — the four core Python
CLIs and the generic / TypeScript / Python plugins (PHP as a bonus) — each phase
through its own implement → gate → reviewer → commit cycle, with no human in the
loop.

The source of truth for **what to build** is the executable specs in
`docs/**/*.spec.md` and the docs they link from (`architecture.md`, `config.md`,
`smell-vocabulary.md`, `sensor-interface.spec.md`). The build is finished when
those specs run green with their `🟡` skip markers removed. Read
`docs/checklist.md` and `docs/DECISIONS.md` first — they are the phase order and
the settled design calls; this spec compresses them into an orchestration shape.

---

## The deterministic gate (every phase proves itself with these)

- `uv run pytest -q` — green. This runs the spec harness over `docs/**/*.spec.md`
  plus the harness's own unit tests. Baseline today: **34 passed, 31 skipped**;
  the 31 skips are the `🟡` cases this build must turn green.
- A spec case is "done" only when its `🟡` is **removed from the `.md`** and the
  harness runs it for real and it passes. Removing a `🟡` without the behaviour
  passing is a failure, not progress.
- Per plugin: a committed **acceptance test** (a new `*.spec.md` case or a pytest)
  that runs the *real* tool against a fixture with a known smell and asserts the
  canonical finding comes out. The docs specs gate the core with fake sensors;
  the real tools are gated here.
- `ruff check .` clean if a `[tool.ruff]`/`ruff.toml` is configured for this repo;
  otherwise skip. Do not invent a lint gate that isn't already wired.

**Never** weaken a test, delete a case, or strip a `🟡` to go green. Never
silence a check. If a behaviour can't pass honestly, stop and report it.

---

## Working conventions (Ivett's global harness — NOT present in the cloud env)

These live in `~/.claude/CLAUDE.md` on Ivett's machine and govern all her work,
but the cloud container can't see them. They bind every subagent here. (The
repo's own `CLAUDE.md` *is* checked in and travels with the repo — read it too;
its gotchas about knip/jq/pnpm/eslint are real.)

**Code principles.** Simple, clean, maintainable over clever or concise. KISS.
Readability and maintainability are primary. Self-documenting names — **no
comments** (if code needs explaining, fix the names/structure instead; the
existing docs/specs carry the rationale). Small functions, single responsibility.
"**Make the change easy, then make the easy change**" — when a change is awkward
because of a design issue, refactor first. Avoid rewrites; prefer the smallest
change that satisfies the spec.

**TDD cycle.** Failing test → minimal code to pass → refactor → re-run. Tests must
pass with **zero warnings/errors**. A failing test is never acceptable and is
always investigated — never worked around, never skipped, never silenced.

**Multi-phase work cycle (already the shape of this spec — hold to it).**
Implementer makes one phase's changes → run lint/tests until clean → reviewer
subagent assesses against the principles + the phase gate → loop back to the
implementer on any flag (don't skip ahead) → only then commit, then start the next
phase. Never bundle phases; never skip the reviewer. If a phase looks like >~50
implementer tool-calls, split it into sub-phases first (subagents hit idle
timeouts around the 25-min / 90-tool-call mark). For small, explicit reviewer-flag
lists, brief a focused **sweep** subagent with the numbered file:line items rather
than re-running the open-ended implementer.

**Acceptance.** Every feature needs an automated test plan, and acceptance must be
verifiable by a **deterministic gate** (tests / grep / script) — which is exactly
the spec-harness gate above. (No frontend here, so no Playwright visual checks.)

**Ask > assume.** On anything risky or genuinely ambiguous, stop and report rather
than guess — there is no human to ask mid-run, so a wrong guess is worse than a
halt. Cosmetic choices: pick the simplest and note it.

**Architecture vs design notes.** If the build surfaces a genuine *architecture*
decision (hard to change, spans modules, prevents drift), record it briefly in the
nearest `CLAUDE.md` and label it human-requested vs agent decision. Do **not**
record low-level design or add rationale comments — fix the code instead.

**Git / irreversibility.** Trunk-based; "main" means the local `main` branch
(read-only reference here — never commit to it). Committing locally is fine and
expected per phase. **Pushing is irreversible and is OUT** unless Ivett explicitly
asks — never push, never force-push, no destructive git/db ops. Use `git mv`/`git
rm` for tracked moves/deletes.

---

## Orchestration shape

Phases are **sequential where there is a real dependency** and **parallel where
there isn't**. Each unit of work is one subagent with a tight brief. After every
implementer subagent in a phase, run the **reviewer subagent** (below); loop back
to the implementer on its flags; only commit when the reviewer is satisfied and
the phase gate is green. Never bundle two phases into one implementer run.

### Phase 0 — Pre-flight & cleanup  *(single agent; barrier before Phase 1)*
- Confirm the baseline gate is green (34 pass / 31 skip). If not, **stop the whole
  run and report** — something is wrong before we start.
- Cleanup from `docs/checklist.md` Phase 0: delete the cruft guides
  `plugins/generic/guides/oversized-function.issues.njk` and
  `plugins/generic/guides/needs-extraction.md`; remove any untracked
  `node_modules/`. Use `git mv`/`git rm` for tracked files.
- Delete the broken `plugins/csharp/` stub wholesale (`git rm -r plugins/csharp`)
  — it is superseded by the PHP plugin and is not being revived.
- Do **not** rebuild the stale plugin TOMLs here — they are replaced wholesale in
  the plugin phases.
- Commit: `chore(rebuild): pre-flight cleanup`.

### Phase 1 — Core CLIs  *(sequential sub-phases; this is the spine)*
Build in dependency order. Each sub-phase is its own implement → gate → review →
commit cycle, driven TDD-style: un-skip **one** spec case at a time, make it pass,
move on. Build only what each case demands.

1. **Config loader + `habit-mapper`** → `docs/habit-mapper.spec.md` (12 cases) green.
   - Read findings JSON on stdin, group by smell, render each smell's guide,
     set the exit code from severity (`enforced`→1, `suggested`→0).
   - **Jinja2** for `.md` guides; the spec templates are already Jinja2 syntax.
   - Guide resolution across the override chain (project `.habit-hooks/<plugin>/`
     before package `plugins/<plugin>/`, walking the ordered `plugins` list,
     `generic` last); a finding's `language` selects a plugin's guide first
     (`architecture.md`).
   - Config (`config.toml`): merge TOML across the resolution chain (`tomllib`,
     read-only) and validate the merged result with **pydantic v2**; per-smell
     `severity`/`guide`/`disabled` overrides, `[runners]` for non-`.md` guides
     (run `<runner> guides/<smell>.<ext>` with the finding on stdin, use its exit
     code, show stdout/stderr). Unknown smell → `enforced` + generic `uncoached.md`.
   - Ship the generic guides the specs reference: `clean.md`, `warning-comment.md`,
     `uncoached.md`, and any `<smell>.md` a green case needs. Severity defaults
     come from the catalogue in `docs/smell-vocabulary.md`.
2. **`habit-sensors`** → `docs/habit-sensors.spec.md` (7) + `docs/sensor-interface.spec.md`
   (2) green. The recursive ETL: resolve the ordered `plugins`, concat each
   plugin's child sensors, run its transformer chain in order, stamp the plugin's
   declared `language`, expand `${files}`/`${dir}` in commands. Scope flags
   `--all`/`--file`/`--branch [base]`/`--last <n>`/`--since <ref>`/`--config <path>`
   and the `[scope]`-derived default (see `docs/habit-sensors.spec.md` table). Bin
   resolution: prepend `node_modules/.bin` and `.venv/bin` to `PATH`. Tool-error
   policy: a sensor that spawn-fails or exits non-2-but-broken yields zero findings
   + a stderr notice + exit 1 — **failure is never false-clean**. Parallel
   leaf-sensor runs via `concurrent.futures` (threads; sensors are subprocess-bound).
3. **`habit-snooze`** → `docs/habit-snooze.spec.md` (6) green. The snooze
   transformer: drop issues whose `key` is in a checked-in JSON index, drop a
   finding when its last issue goes, pass everything else through.
   `--snooze`/`--prune`/`--list` maintain the index (JSON, stdlib).
4. **`habit-hooks`** → `docs/habit-hooks.spec.md` (3) green. Just the composition
   `habit-sensors $ARGS | habit-mapper` — forward args, propagate the mapper's
   exit code. Keep it a few lines.

**Packaging:** turn habit-hooks into a real package — drop `package = false`, add
`[project.scripts]` for `habit-mapper`/`habit-sensors`/`habit-snooze`/`habit-hooks`
and the runtime deps `jinja2`, `pathspec`, `pydantic` (see `docs/checklist.md`
"Packaging shift"). Use **stdlib first** (`argparse`, `subprocess`, `tomllib`,
`json`, `concurrent.futures`); the three deps above are the only runtime additions.

Commit per sub-phase: `build(mapper): …`, `build(sensors): …`, `build(snooze): …`,
`build(hooks): …`.

### Phase 2 — Plugins  *(parallel: one agent per plugin, after Phase 1 is green)*
Three independent agents, disjoint paths (`plugins/generic/`, `plugins/typescript/`,
`plugins/python/` + their own acceptance-test files). Each rebuilds its plugin to
the **new** model and matches `main`'s exact settings. Brief barrier to commit
sequentially (avoid racing `pyproject.toml` edits).

Every plugin agent must, on the old stale TOMLs:
- **Drop `produces`** (ordering is gone — `docs/DECISIONS.md`).
- **List-form globs only** — no brace expansion. `**/*.{ts,tsx}` → `["**/*.ts",
  "**/*.tsx"]` (`docs/config.md`).
- Emit the **new finding shape** `{smell, language?, details, issues:[{key,
  details}]}` — not the old flat `details.issues`.
- Translate raw rule IDs → canonical smell keys exactly per the tables in
  `docs/smell-vocabulary.md`. Use the adapter technique (jq in the `command`) for
  JSON-emitting tools — `docs/authoring-plugins.spec.md` has worked ruff & eslint jq.

**generic** — language-agnostic sensors:
- `line-count` sensor in **Python** (replaces `line-count.js`): emit `oversized-file`
  for files over `--max` (**default 200**); threshold lives in
  `plugins/generic/config.toml` as replace-on-override sensor `args`, not baked in
  the command (`docs/checklist.md` Phase 0 resolution).
- `jscpd` sensor: thin **Python** wrapper around the jscpd CLI → `duplicated-code`.
- Carry over / port the generic guides under `plugins/generic/guides/`.

**typescript** (declares `language = "typescript"`; disables generic `line-count`,
uses eslint `max-lines` for `oversized-file`):
- `eslint` adapter (jq, aggregated), with the `if .fatal then "parse-error"` branch.
- `knip` sensor (Node helper) and `comment` sensor (ts-morph Node helper).
- Match `main`'s exact ESLint rule set + thresholds (table below), and the knip /
  jscpd settings. Ship them wherever the new architecture puts recommended tool
  config (plugin-shipped override template) — do **not** rebuild the deleted
  ~1.3k-line `init` scaffolder (it's deferred, `docs/DECISIONS.md`).

**python** (declares `language = "python"`):
- `ruff` adapter (jq, aggregated) — `ruff check --output-format=json
  --select=C901,PLR0913,PLR0915,F841,F401,BLE001 ${files}`.
- `deptry` sensor (Python helper; deptry's piped stdout is unreliable, so run it
  against a temp `--json-output` file and print the findings) → `DEP002` =
  `unused-dependency`.
- Match `main`'s ruff thresholds (table below).

Commit per plugin: `build(generic-plugin): …`, `build(ts-plugin): …`,
`build(python-plugin): …`.

### Phase 3 — README rewrite  *(single agent; after Phase 2 is green, before PHP)*
Rewrite `README.md` for the shipped tool (`docs/checklist.md` Phase 6). The
current README still describes the deleted npm/TS design (`npm install`, `init`,
"wraps", `habit-hooks.config.js`, baseline). Replace it with the Python pipeline:
the `habit-sensors | habit-mapper` composition, `.habit-hooks/` overrides, the
ordered `plugins` list, and TOML config — accurate to what Phases 1–2 actually
built. Keep it tight; no aspirational features. Run the reviewer (it must check
the README against the real CLIs/config, not the old design). Gate: every command
and config snippet in the README runs / parses as written. Commit:
`docs: rewrite README for the Python pipeline`.

### Phase 4 — PHP plugin  *(bonus; lowest priority; only after Phase 3)*
One agent. A `plugins/php/` plugin (`language = "php"`, `files = ["**/*.php"]`)
covering the smells PHP supports from the catalogue — at least `too-many-parameters`,
`high-complexity`, `oversized-function`, `oversized-file`, `unused-variable`.
Suggested tool: **PHPMD** (`phpmd <files> json <rulesets>`, rulesets
`codesize,unusedcode`) adapted with jq into findings; reuse the generic
`line-count` sensor for `oversized-file`. Add a fixture acceptance test.
**If PHP tooling can't be installed in the run environment, document that, skip
the phase gracefully, and do NOT fail the overall run** — PHP is a nice-to-have.
Commit: `build(php-plugin): …`.

### Phase 5 — Final synthesis  *(single agent; barrier after the rest)*
- Run the full gate: `uv run pytest -q` fully green, and **zero `🟡` remaining**
  in the core spec files (`grep -rl '🟡' docs/*.spec.md` should be empty except
  for any case the docs themselves mark as genuinely deferred — there should be
  none of those for core).
- Return a structured report: which spec files are fully green, the per-plugin
  acceptance results, which thresholds were matched against `main`, the README
  status, and anything deferred or blocked (e.g. PHP).

---

## Reviewer subagent (run after EVERY implementer; this is the quality bar)

Brief each reviewer explicitly:

1. **Correctness** against the phase's spec cases and the rules in `architecture.md`
   / `config.md` / `sensor-interface.spec.md`.
2. **Push back hard on anything not strictly necessary.** Flag any code that
   could be deleted, any option/branch no spec exercises, any abstraction a single
   caller doesn't need, any speculative generality. The bar is *the least code that
   makes the specs pass.*
3. **Demand simplification by leaning on existing libraries** rather than
   hand-rolling: Jinja2 for templating, pathspec for globbing, pydantic for
   validation, `tomllib`/`json`/`argparse`/`subprocess`/`concurrent.futures` from
   stdlib, and **`jq` inside sensor commands** instead of Python remapping code.
   If the implementer wrote a parser, a glob walker, a TOML writer, or a template
   engine by hand, that's a finding — replace it with the library.
4. Naming/structure: self-documenting names, small single-responsibility functions,
   no rationale comments (fix the code instead).

Loop the implementer back on every reviewer finding before committing. For small,
explicit fix lists, a focused sweep agent with the numbered findings is fine; for
open-ended rework, re-run the implementer.

---

## Reference settings to match `main` exactly (embed; don't re-derive)

Recreate these **values**, never copy `main`'s TS code. Raw-rule→smell maps are
already in `docs/smell-vocabulary.md`; these are the numeric thresholds & flags.

**ESLint** (consumer-side config the TS plugin expects / ships as a template;
`ignores: ['dist','coverage','tests/fixtures/**']`):
- `max-lines-per-function` 12 `{skipBlankLines:false, skipComments:false, IIFEs:true}`
- `max-params` 3 · `complexity` 10 · `max-lines` 200 `{skipBlankLines:false, skipComments:false}`
- `no-unused-vars` `{argsIgnorePattern:'^_', varsIgnorePattern:'^_'}` (and `@typescript-eslint/no-unused-vars: 'off'`)
- `eqeqeq` `['error','always']` · `no-var` · `prefer-const` · `no-duplicate-imports`
- `no-warning-comments` `['warn',{terms:['todo','fixme','xxx','hack'],location:'anywhere'}]`
- `@typescript-eslint/no-explicit-any` warn · `no-non-null-assertion` warn · `no-inferrable-types` error
- Test files (`**/*.test.ts`,`**/*.spec.ts`,`tests/**`): `max-lines-per-function` off, `max-lines` off.

**knip** (`knip.json`): `entry: ["src/cli.ts!","src/index.ts!","src/**/*.test.ts"]`,
`project: ["src/**/*.ts!"]`, `ignore: ["dist/**","tests/**"]`.

**jscpd** (`.jscpd.json`): `path:["src"]`, `ignore:["**/*.test.ts","tests/fixtures/**","dist/**","node_modules/**"]`,
`threshold: 0`, `minLines: 5`, `minTokens: 50`.

**ruff** (consumer-side `ruff.toml` the Python plugin expects / ships):
`[lint.mccabe] max-complexity = 10` · `[lint.pylint] max-args = 3`, `max-statements = 12`.
Sensor select: `C901,PLR0913,PLR0915,F841,F401,BLE001`.

**deptry**: `deptry . --json-output <tmpfile>`; map `DEP002` → `unused-dependency`.

---

## On blockers / ambiguity (no human is watching)
- A spec is ambiguous and the linked docs don't settle it → **stop that phase and
  report**; do not guess at observable behaviour.
- A dependency-blocked phase (core sub-phase failing) blocks its dependents — halt
  the dependent chain, but let independent phases (other plugins) continue.
- Internal/cosmetic choices (module layout, helper names) → pick the simplest,
  note it, continue.
- A real tool won't install (PHP especially) → document, skip that plugin's gate,
  continue the rest.
- Stuck after a genuine attempt → stop, summarise what you tried and what blocks
  you. **Never invent a workaround or silence a check to appear done.**

## Guardrails
- Commit per phase on the **current branch** (`v1.0`). **Do NOT push.** Never
  force-push. No destructive git/db ops. (`main` is read-only reference — never
  commit there.)
- Use `git mv`/`git rm` for tracked file moves/deletes.
- Do not disable lint rules, delete tests, or strip `🟡` to go green.
- Stay in scope: the deferred `init` scaffolder is **out of scope** — do not
  rebuild it; log issues, don't fix. (The `plugins/csharp/` stub is deleted in
  Phase 0; don't recreate it.)
- All code changes go through implementer subagents, never the orchestrator
  directly.

## End state
Commit-per-phase on `v1.0` (one commit per core CLI and per plugin, conventional
messages). Working tree clean at the end. **Nothing pushed.** Final agent returns
the structured report described in Phase 4.
