import type { Environment } from 'nunjucks';
import { createEnv, renderTemplate } from './render.js';
import type { GuideAction, MapResult } from '../mapper/mapper.js';
import type { Issue } from '../sensors/types.js';

// The guide coaches the fix and signals pass/fail (docs/guide.md): it renders
// each GuideAction's template against all of that smell's issues, lists the
// uncoached bucket, and computes the exit code.

export interface GuideResult {
  stdout: string;
  exitCode: 0 | 1;
}

export interface GuideInput {
  result: MapResult;
  searchPaths: string[];
}

const CLEAN_BANNER =
  '✅ Habit Hooks: automated checks passed.\n\nHabit Hooks catches structural smells, not correctness or design. If no reviewer sub-agent has reviewed this change set, run one before declaring done.';

function totalIssues(result: MapResult): number {
  const inActions = result.actions.reduce((sum, action) => sum + action.issues.length, 0);
  return inActions + result.uncoached.length;
}

function header(total: number): string {
  return `❌ Habit Hooks: ${total} ${total === 1 ? 'violation' : 'violations'}`;
}

// Command fixes are out of scope; only prompt templates render here.
function renderAction(env: Environment, action: GuideAction): string {
  if (action.action.kind !== 'prompt') return '';
  return renderTemplate(env, action.action.templatePath, { smell: action.smell, issues: action.issues });
}

function uncoachedLine(issue: Issue): string {
  const { source, smell } = { source: issue.details.source, smell: issue.smell };
  const { file, line, message } = issue.details;
  return `- ${source ?? smell}: ${message} (${file}:${line})`;
}

function renderUncoached(issues: Issue[]): string {
  if (issues.length === 0) return '';
  return `⚠️ Uncoached smells\n\n${issues.map(uncoachedLine).join('\n')}`;
}

function exitFor(actions: GuideAction[]): 0 | 1 {
  return actions.some((a) => a.severity === 'enforced' && a.issues.length > 0) ? 1 : 0;
}

export function guide(input: GuideInput): GuideResult {
  const { result } = input;
  if (totalIssues(result) === 0) return { stdout: `${CLEAN_BANNER}\n`, exitCode: 0 };
  const env = createEnv(input.searchPaths);
  const rendered = result.actions.map((action) => renderAction(env, action));
  const sections = [header(totalIssues(result)), ...rendered, renderUncoached(result.uncoached)];
  return { stdout: `${sections.filter((s) => s.length > 0).join('\n\n')}\n`, exitCode: exitFor(result.actions) };
}
