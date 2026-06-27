# DECISIONS

Design calls for the `simplified` rewrite — a ground-up re-org to cut cruft (the
old single-package, TS-baked design was ~5.6k non-test LOC for behaviour that is
a few small pipes). Calls are _human requested_ (Ivett) unless noted.

- **The pipeline is composed commands** — `habit-sensors | habit-mapper` —
  carrying a JSON array of `{smell, language?, details}` findings. `habit-mapper`
  absorbs the old mapper **and** guide stages (route + render + exit). Snoozing
  and adapting are **sensors**, not separate stages.

- **Everything language/tool-specific lives in `plugins/<language>` and
  `plugins/generic`** — each a dir of `sensors/*.toml` specs and `guides/` files,
  contract-only. Generic owns the language-independent sensors (line-count →
  oversized-file, jscpd → duplicated-code). TS keeps eslint/knip/comment; Python
  keeps ruff/deptry.

- **A sensor is a single `.toml`** carrying `command` + `produces` (+ optional
  `language`/`dependsOn`/`files`). It just has to print the findings array; an
  adapter sensor maps a JSON-emitting tool with a `jq` transform in the command
  ([adapter.spec.md](adapter.spec.md)). One descriptor source,
  read statically — no `--describe` subprocess. _(Ivett's call over the agent's
  two-source proposal.)_

- **`.habit-hooks/` in a consumer holds overrides only** (Q1b) — project
  `config.toml` plus any sensor/guide it replaces. Defaults resolve from the
  package, so updating habit-hooks never clobbers tuning. Resolution is
  first-match across `.habit-hooks/<lang>` → `.habit-hooks/generic` →
  `plugins/<lang>` → `plugins/generic`.

- **`oversized-file` defaults to the generic line-count sensor; languages may
  override.** TS uses eslint's `max-lines` instead (disables `line-count` in its
  config, maps `max-lines`); Python keeps the generic sensor. The pattern for any
  generic-vs-language-native smell: generic default, language override.

- **No composite ships by default.** The composite mechanism (`dependsOn` +
  stdin) stays first-class in the contract, but `needs-extraction` was only ever a
  demonstrator — it moves to a demo project. Docs still cite it for the mechanism.

- **Config is TOML** (Q5).

- **The rebuild targets Python** — chosen over a TypeScript build (Python is more
  often present in polyglot dev tooling and avoids shipping binaries) and over a
  Go binary (zero-runtime + Windows, but adds release machinery).

- **Snooze keying: git by default, mtime fallback** — content-accurate without
  hashing every file; pluggable for free since snooze is a filter sensor.

- **Fixes run via configured runners, not direct execution** — only `.md` is
  rendered by default; `[runners]` maps a guide extension to a command, so no
  arbitrary execution ships out of the box.
