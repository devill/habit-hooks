import type { HabitHooksConfig } from '../../../src/config/schema.js';

const config: HabitHooksConfig = {
  prompts: './prompts',
  rules: {
    'high-complexity': { disabled: true },
  },
};

export default config;
