---
id: "bug-088-init-storage-has-no-already-initialized-guard"
type: bug
title: "`initWingfoilStorage` has no already-initialized check, so it overwrites a clean committed `dna.yaml` and commits the diff"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: "P5.1.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`initWingfoilProject` refuses to run in an initialized project: it checks
`detectInitState(root) === 'initialized'` before writing anything. `initWingfoilStorage` — the library
entry point beside it — runs no equivalent check, so it overwrites an existing, clean, committed,
hand-authored `.wingfoil/dna.yaml` with the scaffold's version and commits the diff under
`chore(wingfoil): initialize .wingfoil/ storage (P1.1)`.

## Steps to Reproduce

Verified by `task-092`'s reviewer on a scratch project: with a committed, hand-edited
`.wingfoil/dna.yaml`, calling `initWingfoilStorage` replaced it and committed the replacement.

`src/core/init.ts`: `initWingfoilProject` runs the `detectInitState` check; `initWingfoilStorage` does
not. `grep` for both to see the asymmetry.

## Expected Behavior

The two entry points agree about whether an initialized project may be re-initialized. Whichever
answer is right, one of them is currently wrong.

## Actual Behavior

One refuses, the other overwrites and commits.

## Notes

**It is reachable only from library code.** `initWingfoilStorage` is exported from `src/core` but is
wired to **neither the CLI nor MCP** — it is in no `CORE_MODULES` operation — so no user invocation
reaches it today. That is the whole reason this is `low` rather than serious: the same defect on the
CLI path would destroy a project's configuration on a mistyped command.

`task-092` gave it the **dirty-target** guard that `dl-080`(B) requires, which is a different
question: that guard refuses when the target carries uncommitted modifications, while this bug is
about a target that is perfectly clean and simply already exists. The two are complementary and
neither implies the other.

Worth deciding rather than assuming when this is fixed: whether the right answer is to add the
`detectInitState` check, or to give the function an explicit `force` parameter so a caller that means
to re-scaffold can say so. `dl-062` records a related `--force` discussion scheduled to v0.3.

## Triage & Execution Notes

- triage (2026-09-23): **low**, **not a release blocker**. Unreachable from every shipped surface;
  the cost is an inconsistency between two sibling entry points that a future caller could trip over.
- Scheduled to **v0.3**. No fix task filed.
