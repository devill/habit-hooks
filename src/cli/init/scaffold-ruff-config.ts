import { TOOL_CONFIG_FILENAMES } from '../../detect/tool.js';
import { RUFF_CONFIG_FILENAME, RUFF_CONFIG_TEMPLATE } from './templates/ruff-config.js';
import { scaffoldFile, type ScaffoldResult } from './scaffold-config.js';

export function scaffoldRuffConfig(cwd: string): ScaffoldResult {
  return scaffoldFile({
    cwd,
    candidates: TOOL_CONFIG_FILENAMES.ruff,
    defaultName: RUFF_CONFIG_FILENAME,
    template: RUFF_CONFIG_TEMPLATE,
  });
}
