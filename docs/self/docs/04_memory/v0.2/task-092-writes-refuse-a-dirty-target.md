---
id: "task-092-writes-refuse-a-dirty-target"
type: task
title: "Make the non-transition verbs refuse a target carrying modifications they do not own, per dl-080's ratified write rule"
status: backlog
release: "v0.2"
priority: "medium"
tags: ["v0.2", "core", "audit-trail"]
ref: "dl-080-which-baseline-each-command-reads"
bug: ["bug-078-commitpaths-callers-commit-whatever-is-on-disk"]
depends_on: ["task-088-fix-gated-verbs-commit-only-the-status-change"]
tmpl_version: 260703
---

## Description

`dl-080` is ratified as option **(B)**: reads resolve at `HEAD`, and **a write refuses while its
target carries modifications the command does not own**. `task-088` landed that half for the four
gated Memory verbs. `commitPaths` has six other callers that were deliberately left alone —
`dna set`, `directive create`, `directive assign`, `directive remove`, `init` and `memory add` — and
each still commits its target as it stands in the working tree, so an unrelated uncommitted edit rides
into a `wf(...)` commit whose subject describes only the operation performed.

Reproduced: an uncommitted comment appended to `.wingfoil/dna.yaml` was committed by
`wf(dna): set name`.

Declared a release blocker for `minor-v0.2` alongside the rest of the class, though it is the mildest
of the five: no audit record is corrupted and no authority fabricated — the commit says what it did,
it just also says something it did not.

## Acceptance Criteria

- **AC1** — Reproduce first, on a scratch project against current `main`, with the commands in the
  notes. `bug-078` gives the shape; re-derive it (`bug-075` — a scratch project is required).
- **AC2** — Each of the six callers refuses when its target carries modifications it does not own,
  exiting **`1`** per `spec-005` §1 and naming what is modified. `task-088` added
  `requireUnmodifiedDocument` and the committed-tree postcondition `verifyCommittedScope`, both
  exported from `src/core`; reuse them rather than writing a second mechanism.
- **AC3** — **Two callers are not like the others and must be argued, not assumed.**
  - `memory add` writes a **new** file, so "modifications the command does not own" is a narrower
    notion — establish what it can actually absorb before applying the guard.
  - `init` runs when there may be **nothing committed at all**, and may legitimately write into a
    tree that is dirty by construction. If the uniform rule breaks it, say so and scope it out with
    the reason recorded.
- **AC4** — The ordinary flows still work, pinned by tests: `dna set` on a clean tree, `directive
  create`/`assign`/`remove` on a clean tree, `init` in a fresh repository, `memory add` after another
  element was edited but not committed.
- **AC5** — A test pins the defect for at least `dna set` and one `directive` verb, failing against
  the current code.
- **AC6** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-088`'s Execution Notes first (`dl-015` read_related): it established the guard, the
  refuse-versus-partial-stage argument, and the reason it stayed **per-path** — an unrelated dirty
  file cannot ride in anyway, because `commitPaths` uses `git commit --only -- <path>` (`bug-027`).
  That is why this task is about the *target* being dirty, not the tree.
- `task-091` runs in parallel on the **read** half. It touches the Memory state-machine load and the
  directive role-catalogue check; this task touches the commit path. Do not enter its worktree and do
  not fix its bugs.
- Classify every AC per `dl-014`/T1. AC1, AC2 and AC5 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->
