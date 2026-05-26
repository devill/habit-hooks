# v2 backlog

Ideas that surfaced during v1 development. Not committed to scope — review when v1 ships.

## Candidate rules

### `array-join:fixed-shape` (custom AST)

Detect `[a, b, c, ...].join(sep)` where the array literal has a statically known number of elements. Suggest converting to a template literal.

**Why:** Template literals read more directly when the structure is fixed. Array+join is the right shape only when length is variable.

**Signal:**
- `Array.prototype.join` call on an array literal with all elements known at parse time.
- Bonus: detect repeated joiner strings (e.g., `'\n'`) that could become explicit newlines in a template.

**Anti-cases (don't flag):**
- `.join` on a variable or spread expression — length unknown.
- Arrays with computed elements that wouldn't read well inline.

**Surfaced from:** phase 2 reporter refactor — `renderGroup` was originally `[header, '', body].join('\n')`; cleaner as `${header}\n\n${body}`.

## Candidate features

### Plugin system for custom checks

Let users register their own checks + prompts without forking. A check is `{ id, source, run(files, rules) -> Violation[] }`; a prompt is a markdown file. Config exposes a `plugins: ['./my-checks/foo.js', '@org/habit-hooks-react']` array; we import each, validate the export shape, and register.

Open questions: how plugins ship their prompts (bundled vs separate dir override), how they declare default rules, whether they get a stable Violation type contract.

### Code-coverage signal check

A check that flags untested or undertested lines/files. Same philosophy as the tier-1 rules: don't optimise the metric — treat uncovered code as a signal the tests are not solid yet. Surface as a *suggestion* with guidance to ask "what's the test scenario this code handles?" before adding mechanical coverage.

**Tricky part:** coverage requires knowing the test framework's output format (lcov, json-summary, etc.) and how to invoke it. Coupling to a specific runner makes the check non-generic. Possible shapes:

- Read a coverage report from a configured path (`config.coverage.report: './coverage/lcov.info'`); user runs their own coverage tool first.
- Plugin-based: ship `vitest-coverage-check`, `jest-coverage-check`, etc. as separate plugins (depends on the plugin system above).

Probably belongs *as* a plugin once the plugin system lands.

### `habit-hooks review` — bundled reviewer sub-agent

The "All good" message recommends running a reviewer sub-agent. We could ship that as a subcommand that invokes an LLM with a curated brief based on Ivett's principles. Significant new dependency (LLM client + auth); probably belongs in a sibling package, not core. Worth noting as the natural complement to the structural checks.
