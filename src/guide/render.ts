import { readFileSync } from 'node:fs';
import nunjucks from 'nunjucks';

// Prompts are Nunjucks templates (docs/guide.md). autoescape is off because the
// output is agent-facing markdown/plain text, not HTML; the search paths let a
// template {% include %} shared partials from the override or packaged dirs.
export function createEnv(searchPaths: string[]): nunjucks.Environment {
  const loader = new nunjucks.FileSystemLoader(searchPaths, { noCache: true });
  return new nunjucks.Environment(loader, { autoescape: false });
}

export function renderTemplate(
  env: nunjucks.Environment,
  templatePath: string,
  context: Record<string, unknown>,
): string {
  const source = readFileSync(templatePath, 'utf8');
  return env.renderString(source, context).trimEnd();
}
