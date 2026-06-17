// Turn a rule/smell id into a prompt filename stem. Replacing both path
// separators (`/` and `\`) means a crafted id can never traverse out of the
// prompts directory when joined to it — `../../x` becomes `..-..-x`. Unknown
// smells don't reach the file lookup today, but this keeps the mapping safe if
// that ever changes.
export function slugify(ruleId: string): string {
  return ruleId.replace(/[:/\\]/g, '-').replace(/@/g, '');
}
