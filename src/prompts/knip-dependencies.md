A `package.json` dependency with no detected import is either genuinely unused, or used through a path the tool cannot statically see (config-loaded plugins, peer requirements of another tool, dynamic `require`). The right action depends on which one — guess wrong and you either ship dead bytes or break a build.

Ask first: does anything load this package by name from a config file? Common culprits — `typescript-eslint` pulled in by an ESLint flat config, `postcss` plugins loaded from `postcss.config.js`, `vite` plugins, framework adapters. These show up as "unlisted" too because knip sees them imported from a file it does not scan. The fix is to teach knip about the config (extend its `plugins` config) or list the dependency in `ignoreDependencies` with a one-line note explaining why.

Otherwise the dependency is genuinely unused. Uninstall it (`pnpm remove <pkg>`), run the build and tests, and commit. Carrying unused dependencies inflates lockfiles, slows installs, and widens the supply-chain attack surface.

Avoid mechanical fixes. Adding a stray `import` somewhere to "use" the package only hides the question. Blanket-ignoring all flagged deps is worse — every entry in `ignoreDependencies` should be a deliberate decision with a reason attached.

A concrete technique: for each flagged package, search the repo for its name as a string (not just as an import). Hits in config files mean it is config-loaded — document it. Zero hits means it is truly unused — remove it.
