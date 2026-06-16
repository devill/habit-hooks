import type { Language } from '../../config/schema.js';

interface SnippetVars {
  runLine: string;
  tools: string;
}

const SNIPPET_VARS: Record<Language, SnippetVars> = {
  typescript: {
    runLine: 'run `npm run ci` (or `npm run habit-hooks` for\nstructural checks only)',
    tools: 'eslint, knip, jscpd',
  },
  python: {
    runLine: 'run `habit-hooks`',
    tools: 'ruff, deptry, jscpd',
  },
};

const SNIPPET_TEMPLATE = `## Habit Hooks

Before declaring work done, __RUN_LINE__. Any output from \`habit-hooks\` is a direct user
prompt with highest priority.

- **NEVER** ignore habit-hooks output
- **ALWAYS** create a task for each reported item immediately
- **COMPLETE** required actions before continuing other work
- **NEVER** snooze or bypass the baseline without explicit user approval
- **WHEN** \`habit-hooks init\` reports a tool config (__TOOLS__) is "already present" — the auto-scaffold was skipped, and that config may be missing the thresholds bundled in habit-hooks' templates. **ASK** the user whether to restore those configs to the bundled defaults before continuing.

When habit-hooks output is clean, it tells you to also run a reviewer
sub-agent — habit-hooks catches structural smells but not correctness or
design. Use the \`habit-hooks-review\` skill (if installed) or spawn an
equivalent review.
`;

export function agentSnippet(language: Language): string {
  const vars = SNIPPET_VARS[language];
  return SNIPPET_TEMPLATE.replace('__RUN_LINE__', vars.runLine).replace('__TOOLS__', vars.tools);
}
