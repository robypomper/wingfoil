---
id: "task-088-fix-gated-verbs-commit-only-the-status-change"
type: task
title: "Make `approve`, `reject` and `deprecate` commit the status change and nothing else, and assert it against HEAD rather than against the file on disk"
status: backlog
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "security", "audit-trail"]
ref: "bug-076-approve-commits-whatever-is-on-disk"
bug: ["bug-076-approve-commits-whatever-is-on-disk"]
depends_on: ["task-086-fix-reason-control-chars-history-forgery"]
tmpl_version: 260703
---

## Description

`memory approve` stages and commits the element file as it stands in the working tree. Uncommitted
edits to the body, or to frontmatter fields other than `status`, are absorbed into the commit under a
subject that declares only a state transition and a body that attests an approver's identity. The
postcondition compares the file on disk rather than the committed tree, so it cannot see the
difference.

The rule being broken is explicit for the gated verbs: change **only** the `status` field, and do not
modify any other frontmatter field or the body. `submit` is different by design — it is defined as
filling content *and* moving state — and that asymmetry is part of what this task must encode rather
than flatten.

This is a release blocker for `minor-v0.2`: the release exists to deliver these verbs, and the defect
lets an approval commit carry undeclared content while every recorded fact about it stays true.

## Acceptance Criteria

- **AC1** — Reproduce the defect first, end to end, on a scratch project, and record the commands and
  the resulting commit diff. `bug-076` gives the recipe; re-derive it rather than pasting it. A
  scratch project is required because the verbs cannot be pointed at this repository's own Memory
  (`bug-075`).
- **AC2** — After the fix, running a gated verb against an element file carrying unrelated
  modifications either (a) commits only the `status` change, leaving the other modifications in the
  working tree, or (b) refuses with an explicit error at exit `2` naming what is modified. **Choose
  one and justify it in the design notes** — they are not equivalent: (a) silently defers the user's
  other edits, (b) stops a workflow mid-transition. Say which failure you prefer and why.
- **AC3** — The postcondition compares the **committed tree against `HEAD~1`**, not the file on
  disk, and fails when the commit contains anything beyond the declared change. This is the half that
  makes AC2 checkable rather than hopeful; `task-080`'s lockfile guard is the in-repo precedent for
  asserting a diff rather than an end state.
- **AC4** — `submit` keeps carrying body and frontmatter content, because that is its contract. A
  test pins the asymmetry explicitly, so a later reader cannot conclude the verbs were meant to
  behave alike.
- **AC5** — `reject` is covered as well as `approve`, including its `rejection_reason` frontmatter
  write — which is a legitimate non-`status` change the verb itself makes, and must not be caught by
  its own guard. `deprecate` likewise.
- **AC6** — A test pins the defect itself: it must fail against the current code. State the command
  that shows it red before and green after.
- **AC7** — Nothing in this repository's own history is rewritten or re-verified against the new rule.
  Every transition here was made by hand and predates the guard; `dl-035` forbids rewriting merged
  `wf` commits regardless.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-086`'s Execution Notes first (`dl-015` read_related): it is the most recent work in this
  area, it established how to exercise the verbs from a scratch project, and it closed the other way
  the audit trail could be made to lie.
- The write path is shared across the Memory verbs; find it rather than assuming which module owns
  it, and say in the design notes which verbs route through it.
- Consider what a partial stage means for the git index if the user already staged something else.
  The safe reading is that the verb must not disturb what the user staged; establish what it does
  today before choosing.
- Classify every AC per `dl-014`/T1. AC1, AC2, AC3 and AC6 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->
