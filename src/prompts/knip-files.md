A file that no one imports is either an entry point the tool does not know about, or genuinely orphaned code. Pick one — leaving it in the repo as "probably used somewhere" rots into a maintenance trap.

Ask first: is this file entry-point-like? CLI scripts, server entries, test setup, build hooks, framework-discovered routes — these are called by something other than `import`. If so, the fix is configuration, not deletion: add the path (or a glob covering it) to `entry` in `knip.json` so the tool can see why it exists.

Otherwise the file is orphaned. Delete it. If it is a "kept for reference" or "we might need this again" file, that is a confession that nobody owns it; version control is your reference, not the working tree.

Avoid mechanical fixes. Adding a one-line `import` from somewhere else just to silence knip creates a fake consumer and hides the real status of the file. Wrapping the whole file in a `knip-ignore` comment without first deciding which category it falls into preserves the ambiguity.

A concrete technique: try to delete the file in a scratch branch and run the build and tests. If everything passes, the file was orphaned and you have your answer. If something breaks, you have just located the implicit entry point that needs to be made explicit in `knip.json`.
