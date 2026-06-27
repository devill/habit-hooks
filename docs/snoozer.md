# Snoozer

Snoozing is a **filter sensor** ([sensors.md](sensors.md)): it reads every
`{smell, details}` finding from the other sensors and passes them through
**except** those a project has snoozed.

## The snooze index

Snoozes live in a checked-in file under `.habit-hooks/` (the baseline). Each
entry identifies a finding by a stable hash of its `file` content plus its
`smell`, so a snooze survives line-number drift but lapses when the file
changes — a snoozed smell that moves to new code resurfaces.

A line is dropped when `hash(file-contents) + smell` is present in the index.
Lines without a `file` (project-level smells) are matched on `smell` alone.

## Index lifecycle

The filter reads the index; these commands maintain it (the only stateful part):

| Command  | Effect                                                  |
|----------|---------------------------------------------------------|
| `snooze` | Read findings on stdin, add them all to the index.      |
| `prune`  | Drop index entries whose file no longer produces them.  |
| `list`   | Print the current index.                                |

Pruning is what keeps the baseline honest: a fixed finding's entry is reaped, so
re-introducing it later is caught.

## Why a filter sensor

Snoozing is policy, not detection. Modelling it as a filter sensor keeps the
producing sensors ignorant of project history, and disabling the filter gives a
full unfiltered run for auditing what was hidden.
