---
id: "task-093-dna-mutation-surface-add-remove-update"
type: task
title: "Build the DNA mutation surface dl-081 ratified: `dna add|remove|update --field <full path> --value <v>`, and make the traversal refuse a path that does not resolve"
status: pending
release: "v0.2"
priority: "high"
tags: ["v0.2", "dna", "cli", "mcp"]
ref: "dl-081-dna-mutation-surface-shape"
bug: ["bug-084-dna-key-alias-writes-unschemad-keys", "bug-083-dna-set-cannot-write-array-valued-fields"]
depends_on: ["task-091-reads-resolve-at-head"]
tmpl_version: 260703
---

## Description

`dl-081-dna-mutation-surface-shape` is `ready`, ratified as option **(E)**. Today `dna set` reaches
**7 of roughly 38 schema fields** — `version` and the six scalars under `project` — while 11 fields are
array-valued and 17 more live inside array entries, none of them reachable for create, update or
delete. This task builds the ratified surface.

**Two bugs close under it, in this order:**

- **`bug-084`** first, because the ratification makes it a *precondition*: a path that does not resolve
  must be **refused, never created**. `setDnaValue` currently creates an object for any segment it
  cannot descend into, which is how `dna set tech_stack.cli.framework X` writes `stacks.cli.framework`
  — a key in no schema — and commits it at exit 0.
- **`bug-083`** then, which the new verbs close.

## Acceptance Criteria

- **AC1** — **`bug-084` first, and independently verifiable.** After it, a `--field` path that does
  not resolve against the schema is refused at exit `1` naming the path; no intermediate object is
  created; and `dna set tech_stack.cli.framework Commander` fails instead of committing. The DNA
  pillar still **accepts** unknown keys when *reading* a document (pass-through on read is deliberate
  and must not regress) and refuses to *write* one — pin both halves.
- **AC2** — Three verbs exist: `dna add`, `dna remove`, `dna update`, each taking `--field` and
  `--value`, following `memory add --type … --title …`'s option-bearing grammar.
- **AC3** — **`--field` is a full path.** `--field team.roles` and `--field team.members.roles` are
  different fields and both resolve. Entries inside a collection are addressed **by `name`**, not by
  index: `--field team.members.roberto.roles` reaches that member's role list. Indices are not the
  addressing form — `dl-081` records why.
- **AC4** — **Name uniqueness is a prerequisite of AC3 and must be enforced, not assumed.** Add a
  uniqueness refinement per collection to `src/dna/schema.ts`, or make the verbs refuse when a path
  segment matches more than one entry. Choose and argue it; measured today, WingFoil's own `dna.yaml`
  has 45 entries across 11 collections with zero duplicates, so either choice is non-breaking here —
  establish that it is non-breaking for the scaffold templates too.
- **AC5** — All four path shapes work, each pinned: an array of strings at depth 2
  (`paths.sources`); an array of objects at depth 1 (`modules`); an array of objects at depth 2
  (`team.members`, `stacks.technologies`); and a string array nested inside an object array
  (`team.members.<name>.roles`) — the last being the shape that only this addressing form can express,
  and the one `dl-080` made routine.
- **AC6** — `--value` carries the new entry's identity when the path ends at a **collection** and the
  new value when it ends at a **leaf**. State it in `--help` rather than leaving it to be inferred.
- **AC7** — **MCP parity**: three new core functions mean three new Tools per `spec-006` §3 —
  `dna.add`, `dna.remove`, `dna.update`. Check `spec-004`, which owns Tool names, and report whether
  the shape is awkward there; `dl-081` records that a shape awkward on MCP is the wrong shape.
- **AC8** — **Amend the specs**, per `dl-081` action 3: `spec-002` and `spec-006` at minimum, and the
  CLI grammar spec since the grammar grows. In-place dated Revision notes under `dl-047`, the route
  `task-079`/`task-084`/`task-085` used on `spec-015`. A ratified shape that no spec records is the
  defect this whole class came from.
- **AC9** — `dna set` keeps working for scalars and is not removed. Its relationship to the new verbs
  — whether `set` remains the scalar verb or `update` subsumes it — is a decision: make it and say so.
- **AC10** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- **This is the largest task in the release. If you judge it too large to land coherently, stop and
  report a split proposal rather than half-building it** — a partially implemented ratified grammar,
  where `add` works for members but not modules, is worse than none. `dl-081` action 2 leaves exactly
  this open: whether the whole surface lands or only the collections `dl-080`'s flows need.
- Read `dl-081` in full before designing — the collision measurements, the four shapes, the index
  argument and the two wrinkles are all there, and the ratification's `Reason:` settles three
  questions you would otherwise have to re-open.
- `task-091` runs in parallel and touches the directive role-catalogue read. Coordinate by not
  touching it: this task owns `src/dna/` and the new core functions.
- Classify every AC per `dl-014`/T1.

## Execution Notes

<!-- filled in per phase -->
