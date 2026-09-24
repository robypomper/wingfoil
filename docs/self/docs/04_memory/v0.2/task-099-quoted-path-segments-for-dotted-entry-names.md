---
id: "task-099-quoted-path-segments-for-dotted-entry-names"
type: task
title: "Implement `dl-083`'s quoted path segments so an entry named `Node.js` is addressable, and make the three dotted names already in `dna.yaml` a permanent part of the test corpus"
status: in-progress
release: "v0.2"
priority: "medium"
tags: ["v0.2", "dna", "cli"]
ref: "dl-083-dotted-entry-names-in-paths"
bug: ["bug-091-entry-names-containing-a-dot-are-unaddressable"]
depends_on: ["task-093-dna-mutation-surface-add-remove-update"]
tmpl_version: 260703
---

## Description

`dl-081` made an entry's `name` the key it is addressed by, which made two properties of `name`
load-bearing: uniqueness, and expressibility inside a dotted path. `task-093` implemented the first.
`dl-083` settles the second: a path segment may be double-quoted, and a quoted segment is taken
verbatim, dots included.

```
wingfoil dna update 'stacks.technologies."Node.js".version' --value 22.14+
```

This is sequenced after `task-093` because it edits `src/dna/path.ts`, which that task creates and is
still changing. Read its Execution Notes before starting (`dl-015`).

## Acceptance Criteria

**AC1 — a quoted segment resolves, dots and all.** `stacks.technologies."Node.js".version` addresses
the entry named `Node.js`. Read paths and write paths behave identically; there is one parser.

**AC2 — the delimiters are not part of the name.** A quoted segment begins and ends with `"`; the
quotes are stripped before the name is matched. Quoting a segment with no dot is legal and means the
same as not quoting it — `team."roberto".roles` and `team.roberto.roles` resolve to one place.

**AC3 — an unterminated quote is a usage error at exit 2**, not a name beginning with `"`.
`spec-005` §1 governs the code; do not invent a third outcome.

**AC4 — a quoted segment may not contain `"`, and that is final.** There is no escape sequence.
`dl-083` accepts the consequence deliberately. Refuse it, with a message that says the name is
unaddressable rather than that the path is malformed.

**AC5 — `--value` is untouched.** It carries an entry's identity directly and never needs WingFoil
quoting: `dna remove stacks.technologies --value "Node.js"` quotes for the shell only. Pin this, since
it is the thing a reader will get wrong.

**AC6 — the three live dotted names enter the test corpus.** `docs/self/.wingfoil/dna.yaml` carries
`Node.js`, `Commander.js` and `AI agent (Claude/Cursor/etc.)`. Build a fixture containing all three
and assert each is addressable. This is the test that makes a future dot-ban impossible to add
silently, which is the point of `dl-083`'s Action 4.

**AC7 — no dot constraint is added to the schema.** `uniquelyNamed` stays; nothing joins it. If you
find yourself tempted, `bug-091`'s Correction explains what that would break.

**AC8 — the grammar is recorded.** `spec-008` gains the quoting rule; `spec-002` gains it where the
path form is described. Dated Revision notes, the shape `task-093` used.

## Implementation Notes

- AC1–AC4 are **red-first** under `dl-014`/T1 — none of this behaviour exists. AC5 and AC7 are
  **characterization**: they pin what is already true so it cannot quietly stop being true.
- The shell/WingFoil quoting overlap will confuse a reader: the outer single quotes in the example are
  the shell's and the inner double quotes are WingFoil's. Say so wherever you document it.
- `dl-082` moved the path from `--field` into a positional. The quoting rule is identical either way,
  but write your examples in the grammar `task-093` actually shipped, not in `dl-081`'s.
