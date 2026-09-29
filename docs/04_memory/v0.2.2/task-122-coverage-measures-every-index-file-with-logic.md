---
id: "task-122-coverage-measures-every-index-file-with-logic"
type: task
title: "The coverage gate measures every `index.ts` that holds logic, and excludes only true re-export barrels"
status: in-progress
release: "v0.2.2"
priority: "low"
tags: ["v0.2.2", "testing", "coverage"]
ref: "bug-021-core-index-excluded-from-coverage"
bug: ["bug-021-core-index-excluded-from-coverage"]
depends_on: []
tmpl_version: 260703
---

## Description

`jest.config.js` sets `collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts']`. The glob meant to
skip re-export barrels, and it also hides files that hold real logic (`bug-021`):

- `src/core/index.ts` (1 756 lines), which holds every registered operation's `fn` body;
- `src/mcp/index.ts`, which defines `registerReadOnlyResources`. This file was found while planning
  this task, and `bug-021` does not name it.

The other seven `src/*/index.ts` are re-exports plus a `MODULE_NAME` constant.

**Why a task, not a closure with no code.** The retrospective disposed `bug-021` as "downgraded", a
closure with no code (row 27). The bug's own Expected Behavior cannot be met without changing the
configuration: "a file containing operation logic is measured by the coverage gate". Its Notes give
the narrow fix: exclude only true barrels. `dl-089`'s release-health metric Q03 also assumes coverage
"`index.ts` included". The approver asked on 2026-09-29 for the bug to be re-read, and a task was
created. This closes `bug-021`.

**Out of scope.** `bug-141`, targeted at v0.3, covers the second mechanism: a `src/` file that no
test requires vanishes from the report, because `roots` is `test/` only. `bug-021` itself names that
fix only as optional.

## Acceptance Criteria

1. `collectCoverageFrom` excludes only the `index.ts` files that are pure re-exports, listed
   explicitly or matched by a rule the review can check. `src/core/index.ts` and `src/mcp/index.ts`
   appear in the coverage report. *Red-first:* a test reads the Jest configuration and fails if
   either file is excluded.
2. Which `src/*/index.ts` files are barrels is re-derived when the task runs, not taken from this
   description. The method and the resulting list go in Execution Notes.
3. The >80% thresholds pass with the two files included. Coverage before and after (statements,
   branches, functions, lines) is recorded in Execution Notes. If `src/core/index.ts` or
   `src/mcp/index.ts` falls below a threshold, the missing tests are added here rather than
   re-excluding the file.
4. `npm test` green.

## Implementation Notes

- `bug-021` measured the effect on 2026-09 main with the exclusion removed entirely: statements,
  branches and lines went up, and functions dropped (98.40 → 81.64). The drop is an artefact of
  CommonJS barrels compiling to getter thunks. Keeping true barrels excluded avoids that artefact,
  which is why the fix is narrow and not "remove the exclusion".
- A new `index.ts` that is not a barrel must be measured by default. Prefer a configuration where
  forgetting to update a list errs towards measuring a file rather than hiding it.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
