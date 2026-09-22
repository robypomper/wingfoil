---
id: "task-085-retense-spec-015-sigint-sentence"
type: task
title: "Re-tense spec-015's SIGINT teardown sentence once task-083 lands, so the spec stops describing a gap that has been closed"
status: pending
release: "v0.2"
priority: "medium"
tags: ["v0.2", "documentation", "release", "distribution"]
ref: "bug-062-spec-015-note-carries-transient-findings"
bug: []
depends_on: ["task-083-fix-staging-interrupt-teardown", "task-084-fix-spec-015-stale-stage-1-note"]
tmpl_version: 260703
---

## Description

`spec-015-packaging-publishing` §3 currently states that the staging run's teardown "executes on the
success and failure paths (`runStaging`'s `finally`) but **not** on `SIGINT`". That is true today and
was deliberately kept by `task-084`, which verified that no signal handler is registered anywhere
under `scripts/` and that `bug-059` is not closed.

`task-083-fix-staging-interrupt-teardown` closes exactly that gap. **The moment it merges, the
sentence becomes false** — and the spec will be stale again in the opposite direction from the one
`bug-062` was filed about: it will describe a hole that no longer exists, in the document the
`release-publishing` phase reads.

This task exists because that outcome was foreseen and, on its own, would not have been scheduled.
`task-083`'s Execution Notes identified it and parked it as a *proposed element*; nothing reschedules
a proposal living in a task's notes, which is the precise failure `bug-062` was opened about. Filing
it as a task rather than leaving it in a report is the point.

## Acceptance Criteria

- **AC1** — Run only after `task-083` is `done` and merged into `main`. Verify with
  `git merge-base --is-ancestor` rather than by reading a status field, and record the command. If
  `task-083` has not landed, stop and report — do not describe an unmerged branch as shipped, which
  is the defect `bug-062` covered.
- **AC2** — The sentence is **re-tensed, not deleted**. §3 stage 2 asserts a throwaway per-run work
  dir and stage 3 asserts the registry is torn down afterwards; a reader of those claims needs to
  know the guarantee once had a hole, when it was closed and by what. Deleting it would erase that.
- **AC3** — The new text cites `bug-059` and `task-083` by id, with the commit that closed the bug
  and the merge that landed the task, each verified to be an ancestor of `main` at execution time.
- **AC4** — Describe what the fix actually does, read from `scripts/publish-staging.cjs` as merged —
  not from `task-083`'s notes, not from this task's Description. Whatever signals are handled at that
  point are what the spec says; do not assume the set.
- **AC5** — In-place amendment per `dl-047`: `status: approved` and every other frontmatter field
  unchanged, no supersede, no `version:` bump, and the superseded wording surviving only as a
  quotation inside a dated Revision note — the shape `task-079` established and `task-084` followed.
- **AC6** — `dl-075` respected, with the same boundary `task-084` was given: cite by symbol, heading
  or verbatim quotation plus the commit read at; convert bare offsets only inside the paragraphs this
  task edits, and leave the rest of the document alone. `task-084`'s reviewer noted that the §3 note
  now *names* `README.md:115` when listing what it declined to convert — if that line falls inside an
  edited paragraph, phrase it symbolically instead.
- **AC7** — The diff is this task's own Memory file and `spec-015`. No source, test, workflow or
  configuration file, and no other Memory document.

## Implementation Notes

- Read `task-084`'s Execution Notes first (`dl-015` read_related): it made the same class of edit on
  the same paragraph days earlier, and its approve commit records the AC1-versus-AC4 reasoning about
  keeping superseded wording as a quotation.
- The paragraph is found with `grep -n "Out of this revision's scope"` on the spec — cited by its own
  words rather than by an offset, per `dl-075`.
- `task-084`'s reviewer recorded the two locations that go stale when `task-083` lands. Re-derive them
  yourself rather than trusting that pair; they were read at `307a62a` and the file has changed since.
- Classify each AC per `dl-014`/T1. This is a documentation task: expect characterization throughout,
  and do not fabricate a red.
- `bug:` is deliberately empty. This task closes no bug — `bug-062` is already `closed`, and closing
  it did not depend on this work. It is a successor, not a fix.

## Execution Notes

<!-- filled in per phase -->
