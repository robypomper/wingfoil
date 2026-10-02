---
id: "bug-142-memory-verb-preamble-duplicated-four-times"
type: bug
title: "The identity → prepare-transition preamble is copy-pasted across `memorySubmitFn`/`memoryApproveFn`/`memoryRejectFn`/`memoryDeprecateFn` instead of being shared"
status: closed
severity: "low"
release-origin: "v0.2"
release: "v0.3"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`src/core/index.ts`'s four state-mutating memory verbs each open with the same two calls —
`requireGitIdentity(root)` then `prepareMemoryTransition(root, id, <op>)` — written out
independently four times rather than factored into one shared helper, so a future change to the
preamble (an extra pre-check, a different error shape) has to be made in four places and can drift.

## Steps to Reproduce

1. `grep -n "const identity = requireGitIdentity(root);" src/core/index.ts` → four hits, one inside
   each of `memorySubmitFn`, `memoryApproveFn`, `memoryRejectFn`, `memoryDeprecateFn` (lines 959,
   1045, 1135, 1232 at this commit).
2. `grep -n "prepareMemoryTransition(root, id, '" src/core/index.ts` → four hits immediately after
   each of the above (`'submit'`, `'approve'`, `'reject'`, `'deprecate'`), each call written inline
   rather than through a shared wrapper.
3. Each function's own doc-comment already documents this as steps "1." and its neighbor "4." of an
   identical numbered sequence (`sed -n '941,970p;1013,1055p;1105,1145p;1204,1245p' src/core/index.ts`),
   confirming the four are meant to be, and currently are, the same preamble copied four times rather
   than a single documented sequence called from one place.

## Expected Behavior

The `requireGitIdentity` → `prepareMemoryTransition(root, id, op)` preamble is extracted into one
shared function taking the desired `TransitionOp`, called from all four verbs, so the sequence is
written and can be changed exactly once.

## Actual Behavior

The sequence is duplicated four times with only the operation-name literal (`'submit'`/`'approve'`/
`'reject'`/`'deprecate'`) varying between copies.

## Notes

- Root cause: `prepareMemoryTransition` (`src/core/memory-transition.ts`) already generalizes over
  `TransitionOp`, so nothing structural prevents a shared wrapper — the four call sites were simply
  never consolidated as the verbs were added one task at a time (`memoryAddFn`'s task, then
  submit/approve/reject/deprecate each in their own task).
- This was flagged during v0.2 itself: task-048's Execution Notes propose extracting "the 4-way
  preamble duplication ... as a follow-up in the final report"
  (`docs/04_memory/v0.2/task-048-memory-deprecate.md`), but no bug or task element was ever
  filed for it — `grep -rln "preamble duplication" docs/self/docs/04_memory/ docs/05_plans/` finds
  only that one task's own notes raising it, confirming the deferral never became an element.
- Fix: a small `beginMemoryTransition(root, id, op)` helper returning the identity + prepared
  transition (or the first `CoreResult` error), called from all four verbs in place of the inline
  pair.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (retro-v0.2), closing the gap task-048 raised but never
  turned into its own element.
