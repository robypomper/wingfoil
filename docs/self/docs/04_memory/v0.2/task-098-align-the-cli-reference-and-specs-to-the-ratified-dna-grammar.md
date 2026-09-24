---
id: "task-098-align-the-cli-reference-and-specs-to-the-ratified-dna-grammar"
type: task
title: "Bring the approved CLI reference and the DNA specs onto `dl-082`'s grammar — correct the `dna set` row, add the three rows that were never written, and retire two claims that are no longer true"
status: in-progress
release: "v0.2"
priority: "medium"
tags: ["v0.2", "dna", "cli", "docs"]
ref: "bug-090-dna-set-grammar-differs-across-three-artefacts"
bug: ["bug-090-dna-set-grammar-differs-across-three-artefacts"]
depends_on: ["task-093-dna-mutation-surface-add-remove-update"]
tmpl_version: 260703
---

## Description

`dl-082-cli-parameter-shape` is `ready`. The DNA surface it ratifies is described in four places and
none of them currently matches it. This task moves the documents; `task-093` moves the code, and this
task must land **after** it so both describe the same thing.

`docs/01_vision/X_cli-cmds.md` is **Version 1.2, Status: Approved**. Correcting it to match the
implementation inverts CLAUDE.md §10.1, under which the vision wins. That inversion is deliberate,
confined to this case, and its justification is written in `dl-082`'s Decision section — read it
before you edit, and do not extend it to anything else.

## Acceptance Criteria

**AC1 — the `dna set` row carries the ratified grammar.** `wingfoil dna set <path> --value <VALUE>`.
The row currently reads `dna set [--field FIELD] [--value VALUE]`.

**AC2 — the three missing rows exist.** The Pillar 2 table has no row for `dna add`, `dna remove` or
`dna update`, which have existed since `dl-081` and ship in `task-093`. Add them in `dl-082`'s
grammar, with actors, journeys and notes consistent with the neighbouring rows. `bug-090`'s
2026-09-24 note records why they were absent and why `P2.1` already authorises them — cite that
reasoning rather than re-deriving it.

**AC3 — the stale example goes.** `--field tech-stack.backend --value nodejs` names a schema
`spec-002` retired: `stacks.technologies` is a list of `{name, category, ...}` entries and there is no
`backend` key. Replace it with an example that resolves against the current schema, and verify it
resolves by running it.

**AC4 — the interactive claim is corrected, not deleted.** The row says "interactive or flag-based".
Measured: the global `--no-interactive` is read only by `src/cli/init-command.ts`, and no command but
`init` prompts. State what is true today. If the intention survives as unbuilt scope, say that
explicitly and name where it is tracked; do not leave a reader unable to tell an aspiration from a
description.

**AC5 — `spec-002` and `spec-008` agree with the reference.** Both describe the DNA path grammar.
Amend each under a dated Revision note in the form `task-093` used. If `task-093` has already brought
one of them onto the new grammar, say so and leave it alone rather than amending it twice.

**AC6 — the `--format` question is answered in writing, either way.** The reference attaches
`[--format json/yaml]` to nine rows across four pillars; the implementation registers it once on the
root program. `bug-090`'s note records this and explicitly leaves the decision to this pass. Either
correct those rows or state in the Execution Notes why they are out of scope — an unremarked
third option is not available.

**AC7 — the document's own version discipline.** `X_cli-cmds.md` is at Version 1.2. Bump it and update
its date per the `doc-versioning` directive, on the first edit after commit.

## Implementation Notes

- Documentation-only. There is no red to write; every AC is **characterization or verification** under
  `dl-014`/T1, and that is legitimate here. What replaces a failing test is *running the examples you
  write* — every command that appears in a corrected row must be executed against a throwaway
  `wingfoil init --template Scrum` repository and its output pasted into the Execution Notes. A row is
  not corrected because it looks right.
- `dl-075` is `ready`: durable citations name a symbol, heading, YAML key path or verbatim quotation
  plus the commit read at. Bare `path:line` offsets belong in Execution Notes only.
- Do not touch the BDD feature files. `bug-089` owns them and `task-100` does the work, sequenced
  after this one so the scenarios are written against the grammar this task records.
