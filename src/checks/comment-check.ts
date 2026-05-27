import { Project, SyntaxKind, type Node, type SourceFile } from 'ts-morph';
import type { Check, Violation } from '../types.js';

const MIN_SINGLE = 10;
const MIN_BLOCK = 15;

type CommentKind = 'single' | 'block' | 'JSDoc';

function isExcludedComment(text: string): boolean {
  return text.includes('eslint-disable');
}

function isReportableSingle(text: string): boolean {
  if (!text.startsWith('//')) return false;
  if (isExcludedComment(text)) return false;
  return text.length >= MIN_SINGLE;
}

function isReportableBlock(text: string): boolean {
  if (!text.startsWith('/*')) return false;
  if (isExcludedComment(text)) return false;
  return text.length >= MIN_BLOCK;
}

function truncate(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > 50 ? `${collapsed.substring(0, 50)}...` : collapsed;
}

function makeViolation(file: string, comment: Node, kind: CommentKind): Violation {
  return {
    ruleId: 'comment:non-essential',
    file,
    line: comment.getStartLineNumber(),
    message: `${kind}-line comment: "${truncate(comment.getText())}"`,
  };
}

function classifyBlock(text: string): CommentKind {
  return text.startsWith('/**') ? 'JSDoc' : 'block';
}

function collectSingles(source: SourceFile, file: string): Violation[] {
  return source
    .getDescendantsOfKind(SyntaxKind.SingleLineCommentTrivia)
    .filter((c) => isReportableSingle(c.getText().trim()))
    .map((c) => makeViolation(file, c, 'single'));
}

function collectBlocks(source: SourceFile, file: string): Violation[] {
  return source
    .getDescendantsOfKind(SyntaxKind.MultiLineCommentTrivia)
    .filter((c) => isReportableBlock(c.getText().trim()))
    .map((c) => makeViolation(file, c, classifyBlock(c.getText().trim())));
}

function collectJsDoc(source: SourceFile, file: string): Violation[] {
  return source
    .getDescendantsOfKind(SyntaxKind.JSDoc)
    .filter((c) => isReportableBlock(c.getText().trim()))
    .map((c) => makeViolation(file, c, 'JSDoc'));
}

function findCommentsInFile(source: SourceFile): Violation[] {
  const file = source.getFilePath();
  return [...collectSingles(source, file), ...collectBlocks(source, file), ...collectJsDoc(source, file)];
}

function buildProject(files: string[]): Project {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(files);
  return project;
}

export const commentCheck: Check = {
  id: 'comment',
  async run(files) {
    if (files.length === 0) return [];
    const project = buildProject(files);
    return project.getSourceFiles().flatMap((s) => findCommentsInFile(s));
  },
};
