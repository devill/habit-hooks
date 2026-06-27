# Adapter sensor

An adapter sensor wraps a linter that already emits JSON: its command pipes the
linter's output through `jq` into the canonical findings array. A sensor is just
a command that prints `[{smell, details}]` — `habit-sensors` stamps the spec's
`language` onto each finding.

```toml
# ruff.toml — the transform lives in the command
command  = "ruff check --output-format json ${files} | jq '<transform>'"
produces = ["too-many-parameters"]
language = "python"
```

These examples need no habit-hooks code to pass — `jq` does the whole mapping —
so they are not skipped.

## Flat tools

### Ruff's flat list maps with one jq expression

⌨️
```json
[
  {
    "code": "PLR0913",
    "filename": "src/billing.py",
    "location": {
      "row": 2,
      "column": 1
    },
    "message": "Too many arguments in function definition"
  }
]
```

```bash
jq '[.[] | {
  smell: {"PLR0913": "too-many-parameters"}[.code],
  details: {
    file: .filename,
    line: .location.row,
    column: .location.column,
    message: .message,
    source: ("ruff:" + .code)
  }
}]'
```

🖥️ ✅
```text
[
  {
    "smell": "too-many-parameters",
    "details": {
      "file": "src/billing.py",
      "line": 2,
      "column": 1,
      "message": "Too many arguments in function definition",
      "source": "ruff:PLR0913"
    }
  }
]
```

## Nested tools

### ESLint's per-file messages flatten with `.messages[]`

⌨️
```json
[
  {
    "filePath": "src/billing.ts",
    "messages": [
      {
        "ruleId": "max-params",
        "line": 2,
        "column": 22,
        "message": "Too many parameters (4)"
      }
    ]
  }
]
```

```bash
jq '[.[] | .filePath as $file | .messages[] | {
  smell: {"max-params": "too-many-parameters"}[.ruleId],
  details: {
    file: $file,
    line: .line,
    column: .column,
    message: .message,
    source: ("eslint:" + .ruleId)
  }
}]'
```

🖥️ ✅
```text
[
  {
    "smell": "too-many-parameters",
    "details": {
      "file": "src/billing.ts",
      "line": 2,
      "column": 22,
      "message": "Too many parameters (4)",
      "source": "eslint:max-params"
    }
  }
]
```
