# Next prompt — dogfood knip production mode on habit-hooks

Paste the prompt below to a fresh agent. It adopts the gated knip double-run
(issue #59) on this repo and clears every test-only / dead-code finding it
surfaces, one at a time, with a review gate between each.

---

You are clearing the knip production-pass findings on habit-hooks (issue #59 follow-up).

First, switch this repo over to the new setting. Replace the root `knip.json`
with the production-marked config so habit-hooks runs the gated double-run on
itself:

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/cli.ts!", "src/index.ts!", "src/**/*.test.ts"],
  "project": ["src/**/*.ts!"],
  "ignore": ["dist/**", "tests/**"]
}
```

Confirm a clean baseline first: `pnpm lint && pnpm test && pnpm build` must be
green before you change anything else. Then get the finding list:
`node node_modules/knip/bin/knip.js -c knip.json --production --reporter json --no-exit-code`.
Each unused export/type/file it reports that the default run does not is a
test-only-or-dead finding to clear. Read `src/prompts/unused-export.md` — it is
the coaching prompt and the standard you are fixing to.

Then loop:

1. **Pick one finding** from the list (smallest blast radius first).
2. **Fix it (sub-agent).** Brief a sub-agent on that single finding. The fix is
   one of two things, never a third:
   - **Dead code** — nothing uses it, tests included → delete it and anything
     that only supported it.
   - **Reached only by tests** — drive the behaviour through the real public
     entry point so the test exercises it as production does; or, if the logic
     deserves its own focused test, extract it into its own class/module where
     the tested method is a legitimate public member. Then drop the export.
   Never silence it by adding the file to knip's `entry` or snoozing — the only
   exception is a genuine public API surface knip can't see is consumed, made
   explicit in `entry`/config. The sub-agent must leave `pnpm lint && pnpm test
   && pnpm build` green.
3. **Review it (sub-agent).** A separate sub-agent checks the fix against
   `src/prompts/unused-export.md` and Ivett's principles: did it remove the leak
   at the root (not appease the tool)? Tests still meaningful? No new test-only
   export introduced? No behaviour change beyond the intended removal?
4. **If the review flags anything, go back to step 2** with the review feedback
   for that same finding. Do not move on until the review is clean.
5. **Commit** the single finding's fix, then **go back to step 1** for the next
   finding.

Repeat until the production pass reports no test-only/dead findings (only
genuine public-API entries remain, declared in `knip.json`). Keep each commit to
one finding so the history stays reviewable.
