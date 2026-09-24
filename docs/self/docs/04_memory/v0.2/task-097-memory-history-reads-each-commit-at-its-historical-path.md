---
id: "task-097-memory-history-reads-each-commit-at-its-historical-path"
type: task
title: "Read each commit at the path the element had *then*, so a renamed element's transitions stop reporting null states — and stop leaking git's `fatal:` to the operator while doing it"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "history"]
ref: "bug-080-read-status-at-reads-the-current-path-at-pre-rename-commits"
bug: ["bug-080-read-status-at-reads-the-current-path-at-pre-rename-commits", "bug-071-read-status-at-leaks-git-stderr"]
depends_on: []
tmpl_version: 260703
---

## Description

`reconstructMemoryTransitions` (`src/memory/history.ts`) walks an element's commits with
rename-following, so it *finds* the commits that precede a rename. `readStatusAt`
(`src/memory/audit.ts`) then reads each one with `git show <sha>:<currentPath>` — the path the element
has **now**. At any commit older than a rename the element did not live there, the read fails, and the
transition is reported with `from` and `to` as `null`.

This is live in this repository. `a353c12` renamed five `release` elements from
`planning/v1/` to `planning/rl-v1/`, and every pre-rename transition of all five reports null states.
It defeats **P1.10** for any renamed element, and renames are not exotic here: a Memory type whose
`path` interpolates an id renames every element under it when that id changes.

`bug-071` is the same function's other half — `execFileSync` without an `stdio` option, so git's
`fatal: path '<doc>' exists on disk, but not in '<sha>'` goes straight to the operator's terminal on
every run. It is scheduled here rather than separately because a fix for `bug-080` removes the
*occasion* for that message without removing the *leak*: the moment some other commit legitimately
lacks the file, it returns. Close both, and close them deliberately.

## Acceptance Criteria

**AC1 — the historical path reaches the read.** `git log --follow --name-status` already reports each
rename edge (`R100 <old> <new>`). Thread the path each commit actually used into `readStatusAt`
instead of passing the current one. The walk is the source of truth for "where was this file at this
commit"; `readStatusAt` must stop guessing.

**AC2 — the five live cases report real states.** `minor-v0.1`, and the other four `release` elements
renamed by `a353c12`, report a non-null `from`/`to` for every transition that has one. Pin this with a
test that runs against a **fixture repository containing a rename**, not against this repository —
`bug-075` means the CLI cannot be aimed at our own Memory, and a test that depends on our history
breaks the day someone rewrites it.

**AC3 — a commit where the file genuinely does not exist is still handled.** Before the element's
first commit, or on a branch where it was never added, there is no content to read. That is a
legitimate `null`, distinct from the defect. The test must cover both so a future reader can tell them
apart.

**AC4 — `bug-071`: no git output reaches the operator's stderr.** Give `execFileSync` an explicit
`stdio` and handle the failure in code. Pin it with a test asserting the child's stderr is captured
rather than inherited. Do not rely on AC1 having removed the message.

**AC5 — exit codes unchanged.** `memory history` exits 0 on a clean walk today and must continue to;
`spec-005` §1 governs anything else.

## Implementation Notes

- `dl-080` is `ready`: a read that gates an operation resolves at `HEAD`. This read gates nothing — it
  reconstructs history, and its whole subject is *other* commits — so `dl-080` does not apply here.
  Say so in the Execution Notes rather than leaving a reviewer to wonder whether it was overlooked.
- Classify each AC per `dl-014`/T1 before writing anything. AC2 and AC4 are **red-first** (the
  behaviour is wrong today). AC3 and AC5 are likely **characterization**. Do not fabricate a red.
- `bug-071` is `low` and `bug-080` is `high`; they close together, and the commit that closes them
  should say which change closed which.
