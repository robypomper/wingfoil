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

### design (architect)

**`depends_on`: none.** The frontmatter carries `depends_on: []`, so the `dl-015` read-related gate
has nothing to load.

**Specs.** No tech-spec states the coverage configuration. `grep -rn -i coverage
docs/04_memory/design/specs/*.md` returns only `spec-003` (the `tests.coverage(min: 80)` check name),
`spec-002` (a `coverage_target` example) and two unrelated uses in `spec-007`/`spec-015`; none names
`collectCoverageFrom` or `index.ts`. The `testing` directive (`.wingfoil/directives/custom/testing.md`
line 25) says only "Maintain >80% coverage (Jest); coverage must not regress on merge". So no spec
needs a revision and none is scaffolded; `design` passes through. `dl-089` Q03 ("`index.ts`
included") is the only governance text that assumes the new scope, and this task makes it true.

**Configuration shape chosen.** Keep `src/**/*.ts` as the include and replace the
`!src/**/index.ts` glob with one literal `!src/<module>/index.ts` entry per barrel. A new `index.ts`
that is not listed is measured, which is the direction the Implementation Notes ask for. The rule
that decides "barrel" is written as an AST check in the test (see red), so the review can re-run it
instead of reading the list by eye.

**AC classification (T1, `dl-014`).**

| AC | Class | Why |
|---|---|---|
| 1 | red-first | The behaviour is new: today `!src/**/index.ts` excludes both files. A test reading `jest.config.js` fails before the change. |
| 2 | characterization | Deriving the barrel list is an investigation. It is pinned by the same test (every exclusion must pass the barrel rule; core and mcp must fail it), which passes against the current sources. |
| 3 | characterization | Coverage numbers are measured, not built. Missing tests are red-first only if a threshold fails. |
| 4 | characterization | `npm test` green is a check on the whole suite. |

