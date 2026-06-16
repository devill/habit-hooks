import { TOOL_CONFIG_FILENAMES } from '../../detect/tool.js';
import type { Language } from '../../config/schema.js';
import { JSCPD_CONFIG_FILENAME, jscpdConfigTemplate } from './templates/jscpd-config.js';
import { scaffoldFile, type ScaffoldResult } from './scaffold-config.js';

export function scaffoldJscpdConfig(cwd: string, language: Language): ScaffoldResult {
  return scaffoldFile({
    cwd,
    candidates: TOOL_CONFIG_FILENAMES.jscpd,
    defaultName: JSCPD_CONFIG_FILENAME,
    template: jscpdConfigTemplate(language),
  });
}
