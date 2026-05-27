An `export` that no consumer references is either internal-by-accident or a deliberate public surface the tool does not know about. Either way the current state is misleading — the keyword tells readers "someone outside this module depends on this", and that is not true.

Ask first: is this symbol part of a deliberate public API? Library entry points, framework hooks, plugins, types re-exported for downstream consumers — these are real exports knip just cannot see. The fix is configuration: add the file (or the symbol's containing entry) to `entry` in `knip.json` so the tool stops asking.

Otherwise the export is internal-by-accident. Drop the `export` keyword. The symbol stays — it is still used inside its own module — it just stops pretending to be part of the module's public surface. Tests that imported it directly should reach in via the public API or move into the same module.

Avoid mechanical fixes. Adding a no-op re-export from `index.ts` to satisfy knip does not address the smell; it just makes the implicit public surface look intentional. Suppressing the rule per-symbol scatters the public-API decision across the codebase instead of capturing it in one config file.

A concrete technique: for each flagged export, ask "if I remove the `export` keyword, what breaks?" If nothing breaks, the export was a lie. If something outside the module breaks, you have just discovered an undocumented public dependency — write it down in `knip.json` and treat that file as a public-API surface from now on.
