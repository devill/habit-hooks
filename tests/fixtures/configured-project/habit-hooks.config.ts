import type { HabitHooksConfig } from '../../../src/config/schema.js';

const config: HabitHooksConfig = {
  prompts: './prompts',
  rules: {
    'eslint:complexity': { disabled: true },
  },
};

export default config;
