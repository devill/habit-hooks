# Habit Mapper Interface

`habit-mapper` reads `{smell, details}` findings as JSON on stdin, routes each
smell to its guide, renders the guide, and sets the exit code from the smell's
severity. See [executable_spec.md](executable_spec.md) for how the markers run.

The examples invoke the mapper stage of the `habit-hooks` CLI through this alias:

```bash
habit-mapper() { habit-hooks mapper; }
```

## Using Markdown templates

### A smell renders its guide and blocks the run

A smell prints its coaching guide and fails the run (`too-many-parameters` is
`enforced`, so the exit code is `1`).

📄.habit-hooks/generic/guides/too-many-parameters.md
```markdown
The following function definitions have more than {{ maxAllowed }} parameters:

{% for v in violations -%}
{{ v.file }}:{{ v.line }}
    {{ v.signature }} has {{ v.actual }} parameters
{% endfor %}
Bundle related arguments into an object.
```

⌨️
```json
[
  {
    "smell": "too-many-parameters",
    "details":
    {
      "maxAllowed": 3,
      "violations": [
        {
          "file": "src/billing.ts",
          "line": 2,
          "actual": 4,
          "signature": "bill(customer, items, discount, tax)"
        }
      ]
    }
  }
]
```

```bash
habit-mapper
```

🖥️ ❌ 1
```text
The following function definitions have more than 3 parameters:

src/billing.ts:2
    bill(customer, items, discount, tax) has 4 parameters

Bundle related arguments into an object.
```

## Using executables

<!-- TODO: spec the guides/<smell> script path (a guide that runs instead of
rendering) once the Markdown-template path above is locked. -->
