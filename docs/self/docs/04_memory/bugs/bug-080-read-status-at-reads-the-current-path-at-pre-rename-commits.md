---
id: "bug-080-read-status-at-reads-the-current-path-at-pre-rename-commits"
type: bug
title: "`readStatusAt` reads the element's current path at pre-rename commits, so a renamed element's transitions report null states — five `release` elements in this repository are in that state now"
status: planned
severity: "high"
release-origin: "v0.2"
release: "v0.2"
feature: "P1.10"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`reconstructMemoryTransitions` walks an element's commits with rename-following, but `readStatusAt`
reads each commit's content with `git show <sha>:<currentPath>`. At any commit older than a rename the
element did not live at that path, so the read fails, and the transition is reported with `from` and
`to` as `null`.

This is not a future risk. **This repository is in that state right now**: `a353c12` renamed five
`release` elements from `planning/v1/` to `planning/rl-v1/`, and all five report null states for every
pre-rename transition.

## Steps to Reproduce

Against this repository, using a build of `main` (the walk itself is exercised directly, since
`bug-075` means the CLI cannot be pointed at our Memory):

1. Run `reconstructMemoryTransitions` on `minor-v0.1`.
2. Observe five entries whose `from` and `to` are both `null`, and five
   `fatal: path 'docs/self/docs/04_memory/planning/rl-v1/minor-v0.1.md' exists on disk, but not in
   '<sha>'` lines on stderr.
3. `git log --follow --name-status -- <path>` shows the `R100` edge at `a353c12`.

Reproduced independently by two agents on 2026-09-22 while `task-089` was in review.

## Expected Behavior

Each commit is read at the path the element occupied **at that commit**. `git log --follow
--name-status` already yields the historical path for every edge in the walk, so the information is
available in the walk that is already being performed.

## Actual Behavior

Five pre-rename transitions in this repository's own audit trail report no states at all, and the
reader emits a `fatal:` per commit while exiting 0.

## Notes

**This is what remains after `task-089`.** That task fixed the walk — it no longer attributes the
template's commit to the element — but the walk and the *read* use different notions of the path, and
only the first was corrected. The two defects were adjacent enough to be confused: `bug-077`'s phantom
entry and this bug's null states both surfaced as `fatal:` lines on stderr.

**It absorbs `bug-071` entirely.** That bug asked to suppress `readStatusAt`'s stderr, treating the
`fatal:` as noise from an expected condition. It is not noise in either case: under `bug-077` it
marked a fabricated entry, and here it marks a transition whose states could not be read. Threading
the historical path removes both the null states and the lines. When this is fixed, `bug-071` should
be closed as absorbed rather than worked.

Note the ordering that produced this: `bug-071` was filed first and described the symptom; `bug-077`
found one cause and was fixed; this is the other. A single stderr line stood for two distinct defects,
and suppressing it — as the first bug proposed — would have hidden both.

**Severity is about the trail, not the tool.** Nothing crashes and no wrong state is written; the
audit trail simply cannot answer what happened to a renamed element, which is the question **P1.10**
exists to answer.

## Triage & Execution Notes

- triage (2026-09-22): **high**. It is live in this repository, it defeats P1.10 for any renamed
  element, and renames are not exotic here — a Memory type whose `path` interpolates an id renames
  every element under it when that id changes, which is exactly what `a353c12` was.
- No fix task filed. The remedy is known and narrow — thread each commit's historical path from the
  `--follow --name-status` output into `readStatusAt` — but the approver has not scheduled it, and
  `bug-071` should close with it rather than before it.

## Correction (2026-09-24) — this bug's guidance about `bug-071` would have produced an untested close

The Notes above say that when this bug is fixed, `bug-071` "should be closed as absorbed rather than
worked". That is wrong, and `task-097` was right to contradict it: its AC4 required `bug-071` to be
pinned by its own test and said explicitly not to rely on the path fix having removed the message.

The reasoning is that fixing this bug removes the **occasion** for git's `fatal:` line, not the
**leak**. `readStatusAt`'s `execFileSync` still inherited this process's stderr; it simply stopped
being reached on an ordinary `--follow` walk once each commit was read at its historical path. The
first commit that legitimately lacks the document — a deletion, or a walk that reaches past the
element's creation — brings it straight back. `task-097`'s AC3 covers exactly that case, so the two
defects are adjacent, not nested.

The evidence is stronger than the argument. While implementing `task-097` the developer wrote a new
`git log` probe without `stdio`, and the first otherwise-green test run printed
`fatal: not a git repository (or any of the parent directories): .git` into the suite output. The
leak was reproduced from a **different call** in the same pass that was supposedly making it
impossible. Two further calls still carry it and are now `bug-093`.

Recorded here rather than edited away because the sentence is standing guidance: a reader reaching
this Notes section while closing `bug-071` would have been told, by this document, to close it on the
strength of a symptom disappearing — which is the class of untested claim this release has rejected
four tasks for.

Proposed by `task-097` as an element. Filed as a correction rather than a decision-log because
nothing here needs deciding: the guidance was simply false, and the task that disproved it has already
shipped the test that settles it.
