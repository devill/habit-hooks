export const meta = {
  name: 'build-habit-hooks-overnight',
  description: 'Unsupervised end-to-end build of the habit-hooks Python rebuild: 4 core CLIs + plugins, each phase implement→gate→review→commit on v1.0, never push',
  whenToUse: 'Overnight autonomous build driven by prompts/build-habit-hooks-overnight.md',
  phases: [
    { title: 'Pre-flight' },
    { title: 'Mapper' },
    { title: 'Sensors' },
    { title: 'Snooze' },
    { title: 'Hooks' },
    { title: 'Plugins' },
    { title: 'README' },
    { title: 'PHP' },
    { title: 'Synthesis' },
  ],
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    gateGreen: { type: 'boolean', description: 'true only if `uv run pytest -q` ended with ZERO failed and ZERO errors' },
    gateSummary: { type: 'string', description: 'the exact final pytest summary line, e.g. "46 passed, 19 skipped"' },
    skipsRemoved: { type: 'array', items: { type: 'string' } },
    filesChanged: { type: 'array', items: { type: 'string' } },
    blocked: { type: 'boolean' },
    blockerReason: { type: 'string' },
  },
  required: ['summary', 'gateGreen', 'gateSummary', 'blocked'],
  additionalProperties: true,
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    approved: { type: 'boolean' },
    gateConfirmedGreen: { type: 'boolean', description: 'reviewer independently ran the gate and saw it green' },
    findings: { type: 'array', items: { type: 'string' } },
  },
  required: ['approved', 'gateConfirmedGreen', 'findings'],
  additionalProperties: true,
}

const COMMIT_SCHEMA = {
  type: 'object',
  properties: {
    committed: { type: 'boolean' },
    hash: { type: 'string' },
    subject: { type: 'string' },
    gateStillGreen: { type: 'boolean' },
  },
  required: ['committed'],
  additionalProperties: true,
}

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    gateSummary: { type: 'string' },
    fullyGreen: { type: 'boolean' },
    remainingSkipMarkers: { type: 'array', items: { type: 'string' } },
    coreSpecsGreen: { type: 'array', items: { type: 'string' } },
    pluginAcceptance: { type: 'array', items: { type: 'string' } },
    thresholdsMatched: { type: 'array', items: { type: 'string' } },
    readmeStatus: { type: 'string' },
    deferredOrBlocked: { type: 'array', items: { type: 'string' } },
    workingTreeClean: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['gateSummary', 'fullyGreen', 'workingTreeClean'],
  additionalProperties: true,
}

// ---------------------------------------------------------------------------
// Shared brief fragments
// ---------------------------------------------------------------------------
const COMMON_TAIL = `

---
## Non-negotiable working conventions (these bind you)
- Work in the current repo (branch v1.0). NEVER push, never force-push, no destructive git ops. \`main\` is read-only — never commit to it. Use \`git mv\`/\`git rm\` for tracked moves/deletes.
- The deterministic gate is \`uv run pytest -q\`. It runs the spec harness over docs/**/*.spec.md plus the harness's own unit tests. It must end FULLY GREEN — form "N passed, M skipped" with ZERO failed and ZERO errors — before you may report gateGreen:true. Put the exact final pytest summary line in gateSummary.
- A spec case is DONE only when its 🟡 is removed from the .md AND the harness runs it for real and it passes. NEVER strip a 🟡 without the behaviour passing. NEVER weaken/delete/skip a spec case or silence a check to go green. If a behaviour cannot pass honestly, set blocked:true with a concrete blockerReason — do not fake it.
- The specs invoke the CLIs through a shim like \`habit-mapper() { ../../habit-mapper; }\` — i.e. they expect an executable launcher named habit-mapper / habit-sensors / habit-snooze / habit-hooks reachable two directories up from the per-case working dir. Read tests/harness/ + conftest.py to see how the case working dir is created, and wire the launchers + (if needed) the working-dir location so \`../../<cli>\` resolves. This is core harness wiring — do it cleanly, do NOT special-case individual tests.
- Code principles (Ivett's): simple/clean/maintainable over clever or concise; KISS; self-documenting names with NO explanatory/rationale comments (fix names/structure instead — the docs carry the rationale); small single-responsibility functions; "make the change easy, then make the easy change" (refactor first when a change is awkward because of a design issue); the smallest change that satisfies the spec; avoid rewrites.
- Library-first / stdlib-first: Jinja2 for templating, pathspec (gitwildmatch) for globbing, pydantic v2 for config validation; tomllib/json/argparse/subprocess/concurrent.futures from stdlib; jq INSIDE sensor commands instead of Python remapping. Do NOT hand-roll a parser, glob walker, TOML writer, or template engine.
- Do NOT commit — a separate reviewed step commits after approval. Leave your changes in the working tree.
- Authoritative sources: read prompts/build-habit-hooks-overnight.md (the build spec) and the docs it links (architecture.md, config.md, smell-vocabulary.md, the relevant *.spec.md) BEFORE coding. Read the repo's own CLAUDE.md (its knip/jq/pnpm/eslint gotchas are real).`

function reviewerBrief(name, impl, extra) {
  return `You are the REVIEWER for the "${name}" phase of the habit-hooks overnight build (branch v1.0).
The implementer reports: ${impl.summary || '(none)'}
Gate they claim: ${impl.gateSummary || '(none)'}. Files touched: ${(impl.filesChanged || []).join(', ') || '(unstated)'}.

Your mandate is the "Reviewer subagent" section of prompts/build-habit-hooks-overnight.md. Read it, plus the relevant docs/*.spec.md, architecture.md, config.md, sensor-interface.spec.md. Assess the UNCOMMITTED working-tree changes (\`git diff\` / \`git status\`):

1. Correctness against this phase's spec cases and the rules in architecture.md / config.md / sensor-interface.spec.md.
2. Push back HARD on anything not strictly necessary — code that could be deleted, any option/branch no spec exercises, any abstraction a single caller doesn't need, any speculative generality. The bar is the LEAST code that makes the specs pass.
3. Demand simplification via libraries: Jinja2 / pathspec / pydantic + stdlib (tomllib/json/argparse/subprocess/concurrent.futures) + jq-inside-commands. A hand-rolled parser, glob walker, TOML writer, or template engine is a BLOCKING finding.
4. Naming/structure: self-documenting names, small single-responsibility functions, NO rationale comments.
5. Integrity: inspect \`git diff\` for any 🟡 removed from a .md whose case does not genuinely run+pass, any weakened/deleted assertion, or any silenced check. Any such thing is blocking.

Independently RUN \`uv run pytest -q\` and confirm it is fully green (set gateConfirmedGreen accordingly).
${extra || ''}

Approve ONLY if correctness holds, the gate is genuinely green, no 🟡 was stripped dishonestly, AND there are no must-fix simplicity/principle findings. Return approved + a numbered findings list (empty when approved). Be specific: file:line + what to change.`
}

function commitBrief(name, msg) {
  return `Commit the current working-tree changes for the "${name}" phase of the habit-hooks build, on branch v1.0.
Run \`git add -A\` then \`git commit\` with this EXACT subject line (a short body is fine):
${msg}
Then run \`uv run pytest -q\` once more and confirm it is still green (gateStillGreen). Do NOT push, do NOT force-push, do NOT touch main. Report the commit hash.` + '\n\nNEVER push. Committing locally only.'
}

// ---------------------------------------------------------------------------
// Robust agent wrappers (treat skip/throw as a non-green retry signal)
// ---------------------------------------------------------------------------
async function runImpl(brief, label, phase) {
  try {
    const r = await agent(brief + COMMON_TAIL, { label, phase, schema: IMPL_SCHEMA, agentType: 'claude' })
    if (!r) return { gateGreen: false, blocked: false, summary: 'implementer skipped by user', gateSummary: 'skipped', filesChanged: [] }
    return r
  } catch (e) {
    return { gateGreen: false, blocked: false, summary: 'implementer errored/timed out: ' + String(e), gateSummary: 'error', filesChanged: [] }
  }
}

async function runReview(brief, label, phase) {
  try {
    const r = await agent(brief, { label, phase, schema: REVIEW_SCHEMA, agentType: 'general-purpose' })
    if (!r) return { approved: false, gateConfirmedGreen: false, findings: ['reviewer skipped — re-verify and re-run'] }
    return r
  } catch (e) {
    return { approved: false, gateConfirmedGreen: false, findings: ['reviewer errored: ' + String(e)] }
  }
}

async function runCommit(brief, label, phase) {
  try {
    const r = await agent(brief, { label, phase, schema: COMMIT_SCHEMA, agentType: 'claude' })
    if (!r) return { committed: false }
    return r
  } catch (e) {
    return { committed: false, error: String(e) }
  }
}

// ---------------------------------------------------------------------------
// The implement -> gate -> review -> commit cycle with loop-back
// ---------------------------------------------------------------------------
async function buildCycle(opts) {
  const { name, phase, baseBrief, commitMsg, reviewerExtra = '', maxAttempts = 4, commit = true } = opts
  let feedback = ''
  let last = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const brief = baseBrief + (feedback ? `\n\n## FIRST, address this feedback from the previous attempt before any other work:\n${feedback}` : '')
    log(`[${name}] implementer attempt ${attempt}/${maxAttempts}`)
    const impl = await runImpl(brief, `${name}:impl#${attempt}`, phase)
    last = impl
    if (impl.blocked) {
      log(`[${name}] BLOCKED: ${impl.blockerReason || impl.summary}`)
      return { name, status: 'blocked', detail: impl.blockerReason || impl.summary, impl }
    }
    if (!impl.gateGreen) {
      feedback = `The deterministic gate is NOT yet green (reported: "${impl.gateSummary}"). Keep going until \`uv run pytest -q\` is fully green (zero failed, zero errors). Context: ${impl.summary || ''}`
      log(`[${name}] gate not green ("${impl.gateSummary}") — looping`)
      continue
    }
    log(`[${name}] gate green ("${impl.gateSummary}") — reviewing`)
    const review = await runReview(reviewerBrief(name, impl, reviewerExtra), `${name}:review#${attempt}`, phase)
    if (review.approved && review.gateConfirmedGreen) {
      if (!commit) {
        log(`[${name}] approved (commit deferred)`)
        return { name, status: 'approved', impl, review }
      }
      log(`[${name}] approved — committing`)
      const c = await runCommit(commitBrief(name, commitMsg), `${name}:commit`, phase)
      return { name, status: c.committed ? 'committed' : 'commit-failed', impl, review, commit: c }
    }
    feedback = (review.findings || []).map((f, i) => `${i + 1}. ${f}`).join('\n') ||
      'Reviewer did not approve (gate not confirmed green or unresolved concerns). Re-verify the gate and address quality.'
    log(`[${name}] reviewer flagged ${(review.findings || []).length} item(s) — looping`)
  }
  return { name, status: 'unfinished', detail: `exceeded ${maxAttempts} attempts without approval`, impl: last }
}

function blocksDependents(result) {
  return result.status !== 'committed'
}

// ===========================================================================
// PHASE 0 — Pre-flight & cleanup
// ===========================================================================
phase('Pre-flight')
const phase0 = await buildCycle({
  name: 'pre-flight',
  phase: 'Pre-flight',
  commitMsg: 'chore(rebuild): pre-flight cleanup',
  maxAttempts: 3,
  baseBrief: `Phase 0 — pre-flight & cleanup of the habit-hooks rebuild. Mechanical only; no new behaviour.

1. Confirm the BASELINE gate: run \`uv run pytest -q\`. It must be exactly "34 passed, 31 skipped". If it is NOT, set blocked:true and stop — something is wrong before we start.
2. Cleanup (git rm for tracked, rm for untracked):
   - \`git rm plugins/generic/guides/oversized-function.issues.njk\`
   - \`git rm plugins/generic/guides/needs-extraction.md\`
   - \`git rm -r plugins/csharp\`  (broken stub, superseded by the PHP plugin, not revived)
   - remove any untracked \`node_modules/\` at the repo root (\`rm -rf node_modules\`; it is untracked — no package.json exists)
3. Do NOT rebuild the stale plugin TOMLs — they are replaced wholesale in later phases.
4. Re-run \`uv run pytest -q\`: it must STILL be "34 passed, 31 skipped" (cruft deletions must not change pass/skip counts; if they do, investigate honestly, don't mask).

Report gateGreen + gateSummary + filesChanged. Do not commit (a later step commits).`,
  reviewerExtra: 'For this cleanup phase, focus on: the right files were removed (and only those), the baseline is intact at "34 passed, 31 skipped", and nothing else was touched. No stale TOMLs should have been rebuilt here.',
})

if (phase0.status === 'blocked' || phase0.status === 'unfinished') {
  log(`Pre-flight failed (${phase0.status}: ${phase0.detail}). Halting the whole run before Phase 1.`)
  return { halted: 'pre-flight', phase0 }
}

// ===========================================================================
// PHASE 1 — Core CLIs (sequential spine)
// ===========================================================================
phase('Mapper')
const mapper = await buildCycle({
  name: 'mapper',
  phase: 'Mapper',
  commitMsg: 'build(mapper): config loader + habit-mapper CLI',
  maxAttempts: 6,
  baseBrief: `Phase 1.1 — build the config loader + \`habit-mapper\`, plus the package/harness wiring the whole rebuild needs. Drive TDD-style: un-skip ONE 🟡 case at a time in docs/habit-mapper.spec.md (12 cases), make it pass, move on. Build only what each case demands.

PACKAGING SHIFT (do this first — the CLIs must be invocable):
- Turn habit-hooks into a real package: drop \`package = false\` in pyproject.toml; add the runtime deps \`jinja2\`, \`pathspec\`, \`pydantic\`; add a \`[project.scripts]\` entry for \`habit-mapper\` now (the other three CLIs add theirs in later phases). Choose the simplest sane package layout (e.g. a src/ package) and note your choice.
- The specs call \`../../habit-mapper\` (see the shim in docs/habit-mapper.spec.md and the convention note in the conventions block). Provide an executable launcher named \`habit-mapper\` at the repo root AND wire the harness/conftest so each spec case runs two directories below the repo root (so \`../../habit-mapper\` resolves). Read tests/harness/ + conftest.py first. This wiring is shared by all four CLIs — get it right once, cleanly.

habit-mapper behaviour (docs/habit-mapper.spec.md is the gate; architecture.md + config.md are the rules):
- Read a findings JSON array on stdin, group by smell, render each smell's guide (Jinja2 for .md), set the exit code from severity (enforced→1, suggested→0).
- Guide resolution across the override chain: project \`.habit-hooks/<plugin>/\` before package \`plugins/<plugin>/\`, walking the ordered \`plugins\` list, \`generic\` last; a finding's \`language\` selects a plugin's guide first.
- Config (config.toml): merge TOML across the resolution chain (tomllib, read-only) and validate the merged result with pydantic v2; per-smell severity/guide/disabled overrides; \`[runners]\` for non-.md guides (run \`<runner> guides/<smell>.<ext>\` with the finding on stdin, use its exit code, show stdout/stderr). Unknown smell → enforced + generic \`uncoached.md\`.
- Ship the generic guides the specs reference: \`clean.md\`, \`warning-comment.md\`, \`uncoached.md\`, and any \`<smell>.md\` a green case needs. Severity defaults come from the catalogue in docs/smell-vocabulary.md.

Gate target: all 12 🟡 in docs/habit-mapper.spec.md removed and passing for real; the rest of the suite still green.`,
  reviewerExtra: 'Specifically verify: pydantic actually validates the merged config (not hand-rolled validation); Jinja2 renders the guides (no hand-rolled templating); the override/resolution walk matches architecture.md "Resolution"; severities match docs/smell-vocabulary.md; the launcher + harness working-dir wiring is clean and general (not per-test hacks).',
})
if (blocksDependents(mapper)) {
  log(`Mapper sub-phase did not complete (${mapper.status}). It is the spine — halting Phase 1 dependents; jumping to synthesis report.`)
  return await synthesize({ pre: phase0, mapper })
}

phase('Sensors')
const sensors = await buildCycle({
  name: 'sensors',
  phase: 'Sensors',
  commitMsg: 'build(sensors): recursive-ETL habit-sensors CLI',
  maxAttempts: 6,
  baseBrief: `Phase 1.2 — build \`habit-sensors\`, the recursive ETL runner. Gate: docs/habit-sensors.spec.md (7 cases) + docs/sensor-interface.spec.md (2 cases) all 🟡 removed and passing. Add the \`habit-sensors\` launcher (repo root) + \`[project.scripts]\` entry, reusing the harness wiring the mapper phase established. Drive one 🟡 at a time.

Behaviour (docs/habit-sensors.spec.md + architecture.md "How habit-sensors is built" + sensor-interface.spec.md are the rules):
- Recursive concat-then-transform: a node = transformers ∘ concat(child sensors), evaluated in listed order; the root and each plugin are the same shape. Resolve the ordered \`plugins\`, concat each plugin's child sensors, run its transformer chain in order, stamp the plugin's declared \`language\`, expand \`\${files}\`/\`\${dir}\` in commands.
- Scope flags: \`--all\` / \`--file\` / \`--branch [base]\` / \`--last <n>\` / \`--since <ref>\` / \`--config <path>\`, plus the \`[scope]\`-derived default (see the scope table in docs/habit-sensors.spec.md). Use \`git\` via subprocess for branch/last/since; pathspec (gitwildmatch) for file globbing — NO brace expansion.
- Bin resolution: prepend \`node_modules/.bin\` and \`.venv/bin\` to PATH so project tools beat globals.
- Tool-error policy: a sensor that spawn-fails or exits non-{0,1} (or emits unparseable stdout) yields ZERO findings + a stderr notice + the run exits 1 — failure is NEVER false-clean.
- Parallel leaf-sensor runs via concurrent.futures (threads; sensors are subprocess-bound).

Also: investigate the single 🟡 in docs/authoring-plugins.spec.md — if it is a \`habit-sensors\` behaviour case, turn it green here too; if it requires a real external tool that cannot be installed in this environment, leave it and note it in your summary (do NOT strip it).`,
  reviewerExtra: 'Verify the transformer "pass through everything it does not handle" invariant holds; the recursion composes (root and plugin same shape); pathspec is used for globbing (no hand-rolled walker / no brace expansion); the tool-error policy never produces false-clean; concurrency uses concurrent.futures threads. Confirm sensor-interface.spec.md (the finding contract) passes for real.',
})
if (blocksDependents(sensors)) {
  log(`Sensors sub-phase did not complete (${sensors.status}). Hooks depends on it — halting and reporting.`)
  return await synthesize({ pre: phase0, mapper, sensors })
}

phase('Snooze')
const snooze = await buildCycle({
  name: 'snooze',
  phase: 'Snooze',
  commitMsg: 'build(snooze): issue-key snooze transformer + index commands',
  maxAttempts: 5,
  baseBrief: `Phase 1.3 — build \`habit-snooze\`, the snooze transformer. Gate: docs/habit-snooze.spec.md (6 cases) all 🟡 removed and passing. Add the \`habit-snooze\` launcher + \`[project.scripts]\` entry, reusing the established harness wiring.

Behaviour (docs/habit-snooze.spec.md + DECISIONS.md "Snooze is issue-key based"):
- As a transformer: drop issues whose \`key\` is in a checked-in JSON index; drop a whole finding when its last issue is gone; pass everything else through unchanged (the transformer invariant).
- \`--snooze\` / \`--prune\` / \`--list\` maintain the index (JSON via stdlib; the index is machine-managed, not hand-edited). \`--prune\` drops keys absent from the latest run.`,
  reviewerExtra: 'Verify snooze keys on `key` alone, the transformer passes through everything it does not handle, and the index is plain JSON via stdlib (no TOML writer). Check the --prune semantics against the spec.',
})
if (blocksDependents(snooze)) {
  log(`Snooze sub-phase did not complete (${snooze.status}). Hooks depends on it — halting and reporting.`)
  return await synthesize({ pre: phase0, mapper, sensors, snooze })
}

phase('Hooks')
const hooks = await buildCycle({
  name: 'hooks',
  phase: 'Hooks',
  commitMsg: 'build(hooks): habit-sensors | habit-mapper composition',
  maxAttempts: 4,
  baseBrief: `Phase 1.4 — build \`habit-hooks\`, the composition. Gate: docs/habit-hooks.spec.md (3 cases) all 🟡 removed and passing. Add the \`habit-hooks\` launcher + \`[project.scripts]\` entry.

Behaviour: it is just \`habit-sensors $ARGS | habit-mapper\` — forward args to habit-sensors, pipe its findings to habit-mapper, propagate the mapper's exit code. Keep it to a few lines; do NOT re-implement any sensor/mapper logic.`,
  reviewerExtra: 'This must be a thin composition (a few lines) that forwards args and propagates the mapper exit code. Flag any duplicated logic from the other CLIs.',
})
const coreOk = !blocksDependents(hooks)
if (!coreOk) {
  log(`Hooks sub-phase did not complete (${hooks.status}). Core not fully green — continuing to plugins is unsafe; reporting.`)
  return await synthesize({ pre: phase0, mapper, sensors, snooze, hooks })
}

// ===========================================================================
// PHASE 2 — Plugins (sequential on the shared tree to avoid gate contamination)
// Each plugin is independent; serialized so a half-built plugin can't redden
// the global gate that another plugin's reviewer is checking.
// ===========================================================================
phase('Plugins')
const PLUGIN_BRIEF_TAIL = `

Every plugin agent must, on the old stale TOMLs / new specs:
- DROP \`produces\` (ordering is gone — DECISIONS.md).
- List-form globs only — NO brace expansion. \`**/*.{ts,tsx}\` → \`["**/*.ts","**/*.tsx"]\` (config.md).
- Emit the NEW finding shape \`{smell, language?, details, issues:[{key, details}]}\` — not the old flat \`details.issues\`.
- Translate raw rule IDs → canonical smell keys EXACTLY per the tables in docs/smell-vocabulary.md. Use the jq-in-command adapter technique for JSON-emitting tools (docs/authoring-plugins.spec.md has worked ruff & eslint jq).
- Add a committed ACCEPTANCE test: run the REAL tool against a fixture with a known smell and assert the canonical finding comes out. Prefer a new docs/**/*.spec.md case (the harness will run it); a pytest is also fine. If the required external tool genuinely cannot be installed in this environment, make the acceptance test SKIP cleanly with a clear reason and document it — NEVER leave the global \`uv run pytest -q\` red, and never fake a pass.
- Try hard to install the tool the normal way (e.g. \`uv add --dev ruff\`, or npm for node tools) before declaring it uninstallable.`

const generic = await buildCycle({
  name: 'generic-plugin',
  phase: 'Plugins',
  commitMsg: 'build(generic-plugin): python line-count + jscpd sensors',
  maxAttempts: 5,
  baseBrief: `Phase 2 — rebuild the GENERIC plugin (language-agnostic) under plugins/generic/ to the new model. ${PLUGIN_BRIEF_TAIL}

generic specifics:
- \`line-count\` sensor in PYTHON (replaces line-count.js): emit \`oversized-file\` for files over \`--max\` (DEFAULT 200); the threshold lives in plugins/generic/config.toml as a replace-on-override sensor \`args = ["--max","200"]\`, NOT baked into the command.
- \`jscpd\` sensor: a thin PYTHON wrapper around the jscpd CLI → \`duplicated-code\`.
- Carry over / port the generic guides under plugins/generic/guides/.
- jscpd config to match main (.jscpd.json the plugin ships/expects): path ["src"], ignore ["**/*.test.ts","tests/fixtures/**","dist/**","node_modules/**"], threshold 0, minLines 5, minTokens 50.`,
  reviewerExtra: 'Verify the line-count default (200) lives in config.toml as replace-on-override args, not baked in the command; sensors are Python; findings use the new shape; the jscpd acceptance test runs the real tool (or self-skips cleanly with a documented reason).',
})

const python = await buildCycle({
  name: 'python-plugin',
  phase: 'Plugins',
  commitMsg: 'build(python-plugin): ruff adapter + deptry sensor',
  maxAttempts: 5,
  baseBrief: `Phase 2 — rebuild the PYTHON plugin under plugins/python/ to the new model (it declares \`language = "python"\`). ${PLUGIN_BRIEF_TAIL}

python specifics:
- \`ruff\` adapter (jq, aggregated): \`ruff check --output-format=json --select=C901,PLR0913,PLR0915,F841,F401,BLE001 \${files}\`, mapped to canonical smells via jq per smell-vocabulary.md.
- \`deptry\` sensor (PYTHON helper; deptry's piped stdout is unreliable, so run it against a temp \`--json-output\` file and print the findings): \`DEP002\` → \`unused-dependency\`.
- Match main's ruff thresholds — the consumer-side ruff.toml the plugin expects/ships: \`[lint.mccabe] max-complexity = 10\`; \`[lint.pylint] max-args = 3\`, \`max-statements = 12\`.`,
  reviewerExtra: 'Verify the ruff select list + thresholds match exactly (C901,PLR0913,PLR0915,F841,F401,BLE001; mccabe 10; pylint max-args 3, max-statements 12); jq does the rule→smell mapping (no Python remap); deptry uses a temp --json-output file; DEP002→unused-dependency. Acceptance test runs real ruff (or self-skips cleanly, documented).',
})

const typescript = await buildCycle({
  name: 'ts-plugin',
  phase: 'Plugins',
  commitMsg: 'build(ts-plugin): eslint/knip/comment sensors',
  maxAttempts: 5,
  baseBrief: `Phase 2 — rebuild the TYPESCRIPT plugin under plugins/typescript/ to the new model (declares \`language = "typescript"\`; disables the generic line-count and uses eslint \`max-lines\` for \`oversized-file\`). ${PLUGIN_BRIEF_TAIL}

typescript specifics:
- \`eslint\` adapter (jq, aggregated) WITH the \`if .fatal then "parse-error"\` branch.
- \`knip\` sensor (Node helper) and \`comment\` sensor (ts-morph Node helper).
- Ship main's exact recommended tool config as the plugin's override template (do NOT rebuild the deleted ~1.3k-line \`init\` scaffolder — it is deferred/out of scope):
  ESLint (ignores ['dist','coverage','tests/fixtures/**']): max-lines-per-function 12 {skipBlankLines:false,skipComments:false,IIFEs:true}; max-params 3; complexity 10; max-lines 200 {skipBlankLines:false,skipComments:false}; no-unused-vars {argsIgnorePattern:'^_',varsIgnorePattern:'^_'} (and @typescript-eslint/no-unused-vars 'off'); eqeqeq ['error','always']; no-var; prefer-const; no-duplicate-imports; no-warning-comments ['warn',{terms:['todo','fixme','xxx','hack'],location:'anywhere'}]; @typescript-eslint/no-explicit-any warn; no-non-null-assertion warn; no-inferrable-types error. Test files (**/*.test.ts,**/*.spec.ts,tests/**): max-lines-per-function off, max-lines off.
  knip (knip.json): entry ["src/cli.ts!","src/index.ts!","src/**/*.test.ts"], project ["src/**/*.ts!"], ignore ["dist/**","tests/**"].
- The eslint→smell and knip→smell mappings come from docs/smell-vocabulary.md.`,
  reviewerExtra: 'Verify the eslint adapter has the parse-error fatal branch; the shipped ESLint/knip config values match the table EXACTLY; no init scaffolder was rebuilt; node helpers are minimal. Acceptance test runs the real tool (or self-skips cleanly, documented). Note if node tooling is unavailable in this env.',
})

const pluginResults = [generic, python, typescript]

// ===========================================================================
// PHASE 3 — README rewrite
// ===========================================================================
let readme = { name: 'readme', status: 'skipped', detail: 'plugins did not all complete' }
const pluginsAllOk = pluginResults.every((r) => r.status === 'committed')
if (pluginsAllOk) {
  phase('README')
  readme = await buildCycle({
    name: 'readme',
    phase: 'README',
    commitMsg: 'docs: rewrite README for the Python pipeline',
    maxAttempts: 4,
    baseBrief: `Phase 3 — rewrite README.md for the shipped tool. The current README still describes the deleted npm/TS design (npm install, init, "wraps", habit-hooks.config.js, baseline). Replace it with the Python pipeline ACCURATE to what Phases 1–2 actually built: the \`habit-sensors | habit-mapper\` composition, \`.habit-hooks/\` overrides, the ordered \`plugins\` list, and TOML config. Keep it tight; no aspirational features. Gate: every command and config snippet in the README runs / parses as written (verify them), and \`uv run pytest -q\` stays green.`,
    reviewerExtra: 'Check the README against the REAL CLIs and config that were built (run the commands / parse the snippets), not the old design. Flag any aspirational or inaccurate feature, any leftover npm/init/wraps/config.js/baseline language.',
  })
} else {
  log(`Skipping README — not all plugins committed (${pluginResults.map((r) => r.name + ':' + r.status).join(', ')}).`)
}

// ===========================================================================
// PHASE 4 — PHP plugin (bonus; never fails the run)
// ===========================================================================
let php = { name: 'php-plugin', status: 'skipped', detail: 'prerequisite phase incomplete' }
if (readme.status === 'committed') {
  phase('PHP')
  php = await buildCycle({
    name: 'php-plugin',
    phase: 'PHP',
    commitMsg: 'build(php-plugin): PHPMD-based PHP plugin',
    maxAttempts: 3,
    baseBrief: `Phase 4 (BONUS, lowest priority) — add a \`plugins/php/\` plugin (\`language = "php"\`, \`files = ["**/*.php"]\`) covering the PHP smells from the catalogue: at least too-many-parameters, high-complexity, oversized-function, oversized-file, unused-variable. ${PLUGIN_BRIEF_TAIL}

php specifics:
- Suggested tool: PHPMD (\`phpmd <files> json <rulesets>\`, rulesets \`codesize,unusedcode\`) adapted with jq into findings. Reuse the generic line-count sensor for \`oversized-file\`. Map PHPMD rules → canonical smells per smell-vocabulary.md.
- Add a fixture acceptance test.
- CRITICAL: if PHP tooling (php/phpmd) CANNOT be installed in this run environment, document that clearly, make the acceptance test skip gracefully, set blocked:true with blockerReason "PHP tooling unavailable", and do NOT leave the gate red. PHP is a nice-to-have — its absence must NOT fail the overall run.`,
    reviewerExtra: 'PHP is a bonus. If the tooling is unavailable, the correct outcome is a clean documented skip with the gate still green — that is acceptable, not a failure. If built, verify smells map correctly and the acceptance test runs real phpmd.',
  })
} else {
  log(`Skipping PHP bonus — README phase not committed (status: ${readme.status}).`)
}

// ===========================================================================
// PHASE 5 — Final synthesis
// ===========================================================================
return await synthesize({ pre: phase0, mapper, sensors, snooze, hooks, generic, python, typescript, readme, php })

async function synthesize(results) {
  phase('Synthesis')
  const summary = Object.entries(results)
    .map(([k, v]) => `${k}: ${v && v.status ? v.status : 'n/a'}${v && v.detail ? ' (' + v.detail + ')' : ''}`)
    .join('\n')
  const report = await agent(
    `Phase 5 — final synthesis for the habit-hooks overnight build (branch v1.0).

Prior phase outcomes:\n${summary}\n
Do the following and report:
1. Run the FULL gate: \`uv run pytest -q\`. Capture the exact summary line. fullyGreen = zero failed AND zero errors.
2. Check remaining 🟡: run \`grep -rl '🟡' docs/*.spec.md\`. For the four CORE CLI specs (habit-mapper, habit-sensors, habit-snooze, habit-hooks) + sensor-interface, there should be ZERO 🟡. Report any remaining markers and which file they are in (authoring-plugins.spec.md may retain a marker ONLY if it needs a genuinely-uninstallable external tool — report it explicitly with the reason).
3. Confirm the working tree is clean (\`git status --porcelain\` empty) — every phase should have committed. If not clean, report exactly what is uncommitted (do NOT commit it yourself — just report).
4. Report: which spec files are fully green; the per-plugin acceptance results; which threshold sets were matched against main (eslint/knip/jscpd/ruff/deptry); the README status; and anything deferred or blocked (e.g. PHP, or a plugin whose tool could not be installed).

Do NOT push, do NOT modify code, do NOT strip any marker. This is a read-only verification + report.`,
    { label: 'synthesis', phase: 'Synthesis', schema: REPORT_SCHEMA, agentType: 'general-purpose' },
  )
  return { phases: results, report }
}
