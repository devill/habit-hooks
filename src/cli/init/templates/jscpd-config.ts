import type { Language } from '../../../config/schema.js';

export const JSCPD_CONFIG_FILENAME = '.jscpd.json';

const TYPESCRIPT_JSCPD_TEMPLATE = `{
  "threshold": 0,
  "minTokens": 50,
  "minLines": 5,
  "ignore": ["**/node_modules/**", "**/dist/**", "**/*.test.ts", "**/*.spec.ts"]
}
`;

const PYTHON_JSCPD_TEMPLATE = `{
  "threshold": 0,
  "minTokens": 50,
  "minLines": 5,
  "ignore": ["**/.venv/**", "**/venv/**", "**/__pycache__/**", "**/*_test.py", "**/test_*.py"]
}
`;

const JSCPD_TEMPLATES: Record<Language, string> = {
  typescript: TYPESCRIPT_JSCPD_TEMPLATE,
  python: PYTHON_JSCPD_TEMPLATE,
};

export function jscpdConfigTemplate(language: Language): string {
  return JSCPD_TEMPLATES[language];
}
