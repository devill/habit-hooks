# habit-hooks notes

## Gotchas

### ESLint v10 rejects files outside its `basePath`

When running ESLint programmatically against fixtures or test repos that
live outside the project root, you'll see "File ignored because outside of
base path". Pass `cwd` explicitly to the `ESLint` constructor so its
`basePath` matches where the files actually live. `eslintCheck.run` takes
an optional `cwd` for this reason; the runner always supplies one.
