# v2 backlog

Ideas that surfaced during v1 development. Not committed to scope — review when v1 ships.

## Candidate rules

### `array-join:fixed-shape` (custom AST)

Detect `[a, b, c, ...].join(sep)` where the array literal has a statically known number of elements. Suggest converting to a template literal.

**Why:** Template literals read more directly when the structure is fixed. Array+join is the right shape only when length is variable.

**Signal:**
- `Array.prototype.join` call on an array literal with all elements known at parse time.
- Bonus: detect repeated joiner strings (e.g., `'\n'`) that could become explicit newlines in a template.

**Anti-cases (don't flag):**
- `.join` on a variable or spread expression — length unknown.
- Arrays with computed elements that wouldn't read well inline.

**Surfaced from:** phase 2 reporter refactor — `renderGroup` was originally `[header, '', body].join('\n')`; cleaner as `${header}\n\n${body}`.

## Candidate features

(none yet)
