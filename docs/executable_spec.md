# Executable specs

A `*.spec.md` file is runnable documentation. Prose explains; specially-marked
steps execute and are asserted, so the examples can never drift from the code.
Files are discovered under the test roots — `docs/**/*.spec.md` and each plugin's own `plugins/*/docs/*.spec.md` — and run by the spec test harness.

## Execution contexts

Every Markdown heading opens an **execution context** that runs until the next
heading of the same or higher level.

- Sibling contexts are **isolated**: each runs in its own fresh temporary
  working directory with its own environment.
- A context **inherits** its ancestors' preambles. An ancestor's *preamble* is
  the steps between that ancestor's heading and its first child heading.
  Inheritance accumulates down the whole ancestry (`#` → `##` → `###`).
- Only a **leaf** context (a heading with no child headings) is a test case. It
  runs its inherited preambles in order, then its own steps.

So given:

    # Tool
    ✏️FOO              ← inherited by every leaf under `# Tool`
    ```
    bar
    ```
    ## Group
    📄config.toml      ← inherited by every leaf under `## Group`
    ```toml
    ...
    ```
    ### Example A      ← a test: runs FOO + config.toml, then its own steps
    ### Example B      ← a separate, isolated test: same preamble, fresh dir

`Example A` and `Example B` each start from a clean temp dir with `FOO` set and
`config.toml` written.

## Steps

A step is a **marker** optionally followed by a fenced code block. The block's
info string (` ```json `, ` ```markdown `, …) is cosmetic — only the marker
decides the block's role. ` ```bash ` blocks are **reserved** for commands and
are never consumed as another marker's payload.

| Marker | Meaning |
|--------|---------|
| `📄<path>` + block | Write the block to `<path>` (relative to the temp dir). |
| `📄<path> @<src>` | Copy the repo file `<src>` to `<path>`. `<path>` defaults to `<src>` when omitted (`📄 @<src>`). For externalising large or irrelevant fixtures. |
| `✏️<VAR>` + block | Set environment variable `<VAR>` to the block's content. |
| `⌨️` + block | The block is **stdin** for the next command. |
| ` ```bash ` | Run the command (in the temp dir, with the pending stdin and current env). |
| `🖥️ ✅` / `🖥️ ❌ <N>` | Assert the last command's exit code is `0` / `<N>`. |
| `🚨` | Assert the last command's **stderr**. |

### Asserting output

`🖥️` and `🚨` may be followed by an expected-output block:

- **Block present** → the stream (stdout for `🖥️`, stderr for `🚨`) must equal
  it, after normalising: ANSI stripped, trailing whitespace per line removed,
  trailing blank lines dropped.
- **Block absent** → that stream is not checked.

To assert against volatile output (timestamps, absolute paths), scrub it in the
command itself, e.g. `habit-mapper | sed 's/[0-9]*ms//'`.

Exit code defaults to `0`: a command with no following `🖥️`/`🚨` must still
succeed, so setup steps fail the test if they fail. `🖥️ ❌ <N>` (or the
shorthand `🚨️ ❌ <N>` for stderr-only failures) overrides it. Prefer keeping the
exit code on the `🖥️` line and using `🚨` only for stderr.

### Skipping

A `🟡` at the end of a heading marks that test as **skipped** — the harness
reports it as skipped, not run. Use it to land a spec for behaviour that isn't
built yet without failing the suite, then remove it once the behaviour passes.

## Markers reference (codepoints)

Markers are matched by base codepoint; any U+FE0F variation selector is ignored,
so `🖥️` and `🖥` are equivalent.

| Marker | Codepoint |
|--------|-----------|
| 📄 | U+1F4C4 |
| ✏️ | U+270F U+FE0F |
| ⌨️ | U+2328 U+FE0F |
| 🖥️ | U+1F5A5 U+FE0F |
| 🚨 | U+1F6A8 |
| 🟡 | U+1F7E1 |
| ✅ | U+2705 |
| ❌ | U+274C |
