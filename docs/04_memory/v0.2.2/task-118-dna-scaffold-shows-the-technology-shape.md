---
id: "task-118-dna-scaffold-shows-the-technology-shape"
type: task
title: "The `init`-scaffolded `dna.yaml` shows the `{name, category}` shape of a technology"
status: in-progress
release: "v0.2.2"
priority: "low"
tags: ["v0.2.2", "init", "dna", "first-use"]
ref: "bug-139-dna-scaffold-hides-required-category"
bug: ["bug-139-dna-scaffold-hides-required-category"]
depends_on: []
tmpl_version: 260703
---

## Description

`wingfoil init` scaffolds `stacks.technologies: []` with no example of the required
`{name, category}` shape. A first edit therefore fails schema validation on a field the author never
knew about (`bug-139`). The scaffold is generated in `src/storage/templates.ts`. This closes
`bug-139`.

## Acceptance Criteria

1. The scaffolded `dna.yaml` shows the shape, as a comment or a commented-out example entry, with
   `category` visible. *Red-first:* a test asserts it on the scaffold's text.
2. Uncommenting the example as written gives a `dna.yaml` that validates. *Red-first.*
3. A freshly scaffolded project still validates unedited. *Characterization.*
4. `npm test` green.

## Execution Notes

### design (architect) — 2026-09-29

**`depends_on: []`** — no upstream task's Execution Notes to read (the `dl-015` gate is vacuous).
`bug: [bug-139-dna-scaffold-hides-required-category]`, so `bug.sync_state` moves bug-139 with this
task (`planned → in-progress` done at `start`, commit `889550e3`).

**Specs.** `grep -m1 '^status:'` → `spec-002-dna-yaml-schema: approved`,
`spec-011-storage-layout: approved`. Neither specifies the scaffold's text: `grep -n -i scaffold`
on spec-002 hits only its uniqueness note (line 300, names distinct across templates); spec-011's
hits are about `memory/templates/` and init detection. `P5.1.1-init.feature` only requires "a
complete `.wingfoil/` structure". No spec needs a revision note, no tech-spec is missing, so the
design approval is a pass-through. `grep -n -i "technolog" docs/user-guide.md docs/cli-reference.md`
→ neither quotes the scaffold text (they document `dna add stacks.technologies`), so no user doc
changes.

**Design.** Only `dnaYaml()` in `src/storage/templates.ts` changes. The active line stays
`technologies: []`, deliberately:
- dropping the key (schema-valid, `technologies` is `.optional()`) would make the first
  `dna add stacks.technologies` rewrite `dna.yaml` without its comments (`sed -n 468,469p docs/user-guide.md`,
  §11 Known limitations: the first entry of a collection `dna.yaml` does not contain yet rewrites it
  without its comments);
- an uncommented-in-place entry list under `technologies:` is impossible while `[]` stays (a
  `technologies:` key with only comments under it parses to `null`, which the schema refuses; a second
  `technologies:` key is a duplicate-key parse error).
So the scaffold carries, above `technologies: []`, a comment naming the `{name, category}` shape
(`category` required, free text) and a commented-out example **block** (`technologies:` + one entry
with `name` and `category`) that the comment says replaces the `technologies: []` line, plus the
`dna add … --entry-category` equivalent. "Uncommenting the example as written" (AC 2) is therefore
read as: strip the `# ` prefix from the example block and put it in place of the `technologies: []`
line, exactly as the scaffold's own comment instructs. **Flag for the approver:** this reading of AC 2
is a choice; the alternative (drop `technologies: []`) was rejected for the comment-loss reason above.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — scaffold shows the shape, `category` visible | red-first | `grep -n "category" src/storage/templates.ts` → no hit in `dnaYaml()` today |
| 2 — the uncommented example validates | red-first | there is no example to uncomment today, so the test cannot find it |
| 3 — a fresh scaffold validates unedited | characterization | already pinned by `test/storage/templates.test.ts` (bug-005 suite, `DnaYaml.safeParse`); extended to the real two-pass loader `loadDnaYaml` |
| 4 — `npm test` green | characterization | gate, run at refactor/review |

### red

### green

### refactor

### review
