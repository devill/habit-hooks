import { runTool } from '../../wrap/shell.js';

export interface CommandResult {
  ok: boolean;
  output: string;
}

export type CommandRunner = (_command: string, _cwd: string) => Promise<CommandResult>;

const FAILURE_TAIL_LINES = 3;

function lastLines(text: string, count: number): string {
  const lines = text.trim().split('\n');
  return lines.slice(-count).join('\n').trim();
}

function combinedOutput(stdout: string, stderr: string): string {
  return `${stdout}${stderr}`.trim();
}

// Our generated commands are simple (e.g. `pip install ruff deptry`,
// `npm install --save-dev jscpd`), so a whitespace split into bin + args is safe.
export const runCommandWithShell: CommandRunner = async (command, cwd) => {
  const [bin, ...args] = command.trim().split(/\s+/);
  if (bin === undefined) return { ok: false, output: 'empty command' };
  const result = await runTool({ bin, args, cwd });
  const ok = result.exitCode === 0;
  if (ok) return { ok, output: combinedOutput(result.stdout, result.stderr) };
  return { ok, output: lastLines(combinedOutput(result.stdout, result.stderr), FAILURE_TAIL_LINES) };
};
