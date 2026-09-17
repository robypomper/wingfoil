---
id: "bug-027-commit-paths-commits-whole-index"
type: bug
title: "commitPaths commits the whole git index, so pre-staged files leak into wf(*) memory commits"
status: in-review
severity: "high"
release-origin: "v0.2"
release: "v0.2"
feature: "P1.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`commitPaths` (`src/storage/commit.ts`) runs `git add -- <paths>` followed by `git commit -m <msg>` with
no pathspec, so the commit records the **entire index**: anything already staged in the working tree
is swept into a commit that claims to be scoped to its paths.

## Steps to Reproduce

1. In a scratch git repository with one commit, create files `a` and `b`, and stage only `b`
   (`git add b`).
2. Call `commitPaths(root, ['a'], 'only a')` (reproduced against `main`'s built
   `dist/storage/commit.js` at `117e95f`).
3. `git show --stat HEAD` lists **both** `a` and `b`.

The same was reproduced end-to-end on `task/task-045-memory-submit` by the task-045 reviewer: a staged
`other.txt` plus `wingfoil memory submit task-101` produced one `wf(task): submit task-101` commit
containing both `task-101.md` and `other.txt`.

## Expected Behavior

The commit contains exactly the paths passed to `commitPaths`; any other staged change stays staged
and uncommitted.

## Actual Behavior

Every pre-staged change is committed together with the scoped paths, under a subject that names only
the memory operation.

## Notes

- **Contract broken:** CLAUDE.md §5.1 requires each Memory operation to produce exactly one commit that
  contains only the file(s) it operates on (P1.2 / P1.10 read history per element). The TSDoc of
  `commitMemoryTransition` on the task-045 branch ("commit exactly that one path") is false while this
  stands.
- **Scope:** pre-existing since `task-018`; every mutating verb routed through `commitPaths` is
  affected — `memory add`, `dna set`, `directive create`, and the transition verbs of task-045..048.
  It matters most now because `memory submit` is about to be dogfooded from worktrees where unrelated
  work is routinely staged.
- **Suspected fix (verified by the task-045 reviewer):** `git commit --only -m <msg> -- <paths>` —
  commits only the named paths and leaves other staged files staged. A regression test must stage an
  unrelated file before the call and assert it is absent from the commit and still staged after.

## Triage & Execution Notes

- capture: raised by the independent review of `task-045-memory-submit` (Wave 2, 2026-09-17), filed
  under `bug-ingest-rel-v0.2-review-findings-plan`.
