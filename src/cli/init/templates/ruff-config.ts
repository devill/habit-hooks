export const RUFF_CONFIG_FILENAME = 'ruff.toml';

export const RUFF_CONFIG_TEMPLATE = `[lint.mccabe]
max-complexity = 10

[lint.pylint]
max-args = 3
max-statements = 50
`;
