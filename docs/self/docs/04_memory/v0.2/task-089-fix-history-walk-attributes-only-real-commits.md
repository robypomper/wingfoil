---
id: "task-089-fix-history-walk-attributes-only-real-commits"
type: task
title: "Stop `memory history` reporting a commit that never contained the element: `--follow` chases the copy from the type's template"
status: backlog
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "audit-trail"]
ref: "bug-077-history-follow-attributes-template-commits"
bug: ["bug-077-history-follow-attributes-template-commits"]
depends_on: ["task-086-fix-reason-control-chars-history-forgery"]
tmpl_version: 260703
---

## Description

`memory history` walks an element's commits with `git log --follow`. Every element is created by
copying its type's template, which the scaffold has already committed, so `--follow` continues past
the element's own first commit into the commit that added the **template** and reports it as a history
entry — with a real sha, author and timestamp, and `operation`, `from`, `to`, `approver` and `reason`
all `null`.

It fires for every element in every project created by `wingfoil init`, because that command commits
the scaffold. A reader asking when an element first appeared would reasonably take the earliest entry,
which is a commit that does not contain it.

This is a release blocker for `minor-v0.2`: `memory history` is the whole of **P1.10**, and this is
the second way this release has found to make it report something that did not happen.

## Acceptance Criteria

- **AC1** — Reproduce first on a scratch project (`bug-075` — the verbs cannot read this repository's
  own Memory), showing the `--follow` walk returning more commits than a plain `git log -- <path>`,
  and showing that the extra commit does not contain the element. Put the commands in the notes.
- **AC2** — After the fix, `memory history` reports exactly the commits that touched the element, and
  no entry whose tree lacks the path. Verified on a fresh scaffold-derived element, which is the case
  that fires today.
- **AC3** — **Renames must keep working.** `--follow` is presumably there so an element renamed on
  disk keeps its history, and that requirement is real. Establish by experiment whether a Memory
  element is ever renamed in practice, then either preserve rename-following or state plainly in the
  design notes that it is being dropped and what that costs. Do not drop it silently.
- **AC4** — The mechanism is chosen and argued, not guessed. At least two shapes are available:
  stopping the walk at the commit that introduced the path, and discarding entries whose tree does
  not contain it. The second is cheap because `readStatusAt` already discovers exactly that and
  currently throws it away as stderr. Weigh them in the design notes.
- **AC5** — No entry is silently dropped where the right answer is an error. If a commit cannot be
  read for a reason other than "this tree does not contain the path", that is a failure and must not
  be folded into the same filter — `bug-072` records the failure mode where an unreadable walk is
  reported as an empty history.
- **AC6** — A test pins the defect: it must fail against the current code, and exercise the real
  scaffold-then-add sequence rather than a synthetic rename.
- **AC7** — `bug-071` is **not** fixed here beyond what falls out naturally. It is downstream of this
  and its own remedy — suppressing git's stderr — would have hidden this defect. If the `fatal:`
  disappears as a consequence of your fix, say so; do not add a stderr suppression to make it
  disappear.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-086`'s Execution Notes first (`dl-015` read_related): it rewrote this module's framing
  and its record-recovery, and its arity work is the most recent change to the same walk.
- `bug-072` (no `maxBuffer`, `catch` returning an empty array) lives in the same function and is
  **not** in scope — but do not make it worse, and say in the notes whether your change touches that
  `catch`.
- Classify every AC per `dl-014`/T1. AC1, AC2 and AC6 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->
