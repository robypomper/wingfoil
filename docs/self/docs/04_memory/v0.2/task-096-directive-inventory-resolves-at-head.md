---
id: "task-096-directive-inventory-resolves-at-head"
type: task
title: "Resolve the directive inventory and its references at `HEAD`, so `assign` cannot bind a file present in no commit and `remove` cannot delete one the committed `roles.yaml` still binds"
status: backlog
release: "v0.2"
priority: "high"
tags: ["v0.2", "directives", "security"]
ref: "bug-086-directive-inventory-read-from-the-worktree"
bug: ["bug-086-directive-inventory-read-from-the-worktree"]
depends_on: ["task-091-reads-resolve-at-head", "task-092-writes-refuse-a-dirty-target"]
tmpl_version: 260703
---

## Description

Two directive verbs decide against the working tree, and they are one read seen from two sides —
**which directive files exist, and what references them**.

- **`directive assign`** checks `--directive` against the files on disk, so an untracked file can be
  bound and the committed `roles.yaml` then names a directive present in no commit.
- **`directive remove`** checks REQ-SEC-07 clause (b) against the working tree's `roles.yaml`, so an
  uncommitted deletion of the reference is enough to **destroy** a file the committed `roles.yaml`
  still binds — the only WingFoil verb that deletes an artefact.

`task-091` moved `--role` to `HEAD` and left both of these, offering the boundary "governance versus
the asset being operated on". Its reviewer showed the boundary does not hold: `directive remove`'s
check reads `roles.yaml`, which is governance by that same definition. What actually separates them is
**cost** — and cost is a scheduling reason, not a rule.

Declared a release blocker at `high`.

## Acceptance Criteria

- **AC1** — **The missing primitive comes first and is the task's real work.** Reading the directive
  inventory at a revision needs a *directory listing at that revision* — a `git ls-tree`-shaped
  facility `src/storage` does not have. Build it there, beside `readPathAtRev`, with its own tests
  and TSDoc. It is reusable and should be written as such, not inlined into a directive check.
- **AC2** — Reproduce both halves first, on scratch projects against current `main` (`bug-075`):
  `assign` binding an untracked `ghost` directive, and `remove` deleting a directive the committed
  `roles.yaml` still binds twice. Commands in the notes, and for `remove` show the file gone and
  `git show HEAD:.wingfoil/roles.yaml | grep -c` still non-zero.
- **AC3** — After the fix both reads resolve at `HEAD`, following `task-091`'s shape (parameter
  removed, decision unreachable from a working-tree copy). Refusals exit **`1`** per `spec-005` §1.
- **AC4** — **`remove` is the half that must not be got wrong.** Its check answers "may this asset be
  deleted?", and a wrong answer destroys a file. Establish what happens when the directive file
  itself is uncommitted — deleting an untracked file is not the same act as deleting a committed one,
  and refusing both may be wrong. Argue it.
- **AC5** — The ordinary flows still pass, each pinned: assigning a committed directive to a
  committed role; the add-commit-assign sequence; removing a directive whose reference was removed
  **and committed**; and `task-091`'s `--role` check unchanged.
- **AC6** — Tests pin both defects and fail against current code.
- **AC7** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-091`'s Execution Notes first (`dl-015` read_related), including its D2 section, which
  argues the boundary this task overturns — and `bug-086`'s Notes, which record why.
- `dl-042`'s warnings channel already reports a directive bound to a role with no directive file.
  Check whether it still behaves correctly once the inventory is committed-resolved: a warning that
  can no longer occur is dead code, and one that changes meaning should be updated.
- The new storage primitive is the part most likely to outlive this task. Give it the TSDoc a future
  caller will read, and say in the notes what else could use it.
- Classify every AC per `dl-014`/T1. AC2, AC3 and AC6 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->
