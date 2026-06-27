# Sensors

A sensor **finds smells**. It runs a tool (or a custom script) and emits a JSON
array of `{smell, details}` findings, translating raw tool output into canonical
[smell keys](smell-vocabulary.md).

Sensors are **additive** (each contributes findings independently) and
**deterministic** (mechanical detection, no judgement).

## A sensor is a `.toml` spec

Every sensor is `sensors/<name>.toml`. The spec is both the descriptor (read
statically, so ordering needs no subprocess) and the recipe for running it.

```toml
command  = "ruff check --output-format=json ${files} | jq '<transform>'"  # required
produces = ["too-many-parameters", "high-complexity"]   # required
language  = "python"                     # optional; stamped onto every finding this sensor emits
dependsOn = []                           # optional; smells consumed (composites)
files = ["**/*.py"]                      # optional; overrides discovery globs
```

| Field       | Required | Meaning                                                     |
|-------------|----------|-------------------------------------------------------------|
| `command`   | yes      | Shell command to run; it must print a JSON array of `{smell, details}` findings. `${files}` expands to the scoped file list; `${dir}` to this spec's directory (for bundled scripts). |
| `produces`  | yes      | Smell keys this sensor can emit (used for ordering + activation). |
| `language`  | no       | Language key stamped on every finding this sensor emits — drives per-language guide overrides. |
| `dependsOn` | no       | Smell keys it consumes — makes it a composite (see below).  |
| `files`     | no       | Per-sensor discovery globs, overriding the project/plugin globs. |

## Two kinds of sensor

The difference is only in the `command`:

- **Native sensor** — the command prints `{smell, details}` findings directly (a
  custom AST tool, a one-line script). `habit-sensors` takes its output verbatim.
- **Adapter sensor** — wraps a tool that already emits JSON (ESLint, Ruff) and
  pipes it through `jq` to reshape it into findings. The transform lives in the
  command — there is no separate mapping language. See
  [adapter.spec.md](adapter.spec.md) for worked `jq` transforms.

Anything `jq` can't express becomes a native sensor with a small script.

## habit-sensors

`habit-sensors` assembles and runs the enabled sensors:

1. **Resolve** the sensor set: plugin defaults, minus `disabled`, plus project
   overrides ([config.md](config.md)).
2. **Order** by dependency. Leaf sensors (no `dependsOn`) run first, in
   parallel. A composite runs once every producer of its `dependsOn` smells has
   finished. Unsatisfiable dependencies or cycles are a startup error.
3. **Run** each sensor's `command` and stamp its `language` onto each finding. A
   composite receives the findings for its `dependsOn` smells on **stdin**.
4. **Merge** every sensor's findings into one JSON array on stdout.

### Activation

A sensor only runs when at least one smell it `produces` is active — has a
non-disabled smell entry resolving to a non-empty in-scope file set. Disabling
every smell a sensor produces suppresses the whole sensor.

### Failure is not false-clean

A sensor must never silently swallow a broken tool. A spawn or timeout failure
surfaces as a stderr notice with zero findings for that sensor **and fails the
run (exit 1)** — a broken tool is a failed run, not a clean one. Every other
sensor still contributes its full output.

## Composites

A composite sensor sets `dependsOn` to the smells it consumes. It emits a
derived smell from their co-occurrence — e.g. `oversized-file` +
`duplicated-code` in one file → `needs-extraction`. This keeps combination
logic in the sensor layer and the mapper a pure single-smell function. By
default a composite **augments** (all smells show); a spec may instead
**replace** its inputs for the affected files.

No composite ships by default — `needs-extraction` lives in the demo project as a
worked example. The mechanism is part of the contract regardless.

## Filter sensors

A transforming sensor may **drop** findings instead of adding them. Snoozing is
the shipped example: it reads every finding and passes through all but the
snoozed ones (see [snoozer.spec.md](snoozer.spec.md)).

## Custom sensors

A project adds a sensor by dropping `sensors/<name>.toml` in its `.habit-hooks/`
plugin dir and pairing it with a smell entry ([config.md](config.md)). A native
sensor in any language works — it only has to print a `{smell, details}` JSON array:

```toml
# .habit-hooks/python/sensors/instanceof.toml
command  = "python ${dir}/instanceof.py ${files}"
produces = ["instanceof-check"]
```
