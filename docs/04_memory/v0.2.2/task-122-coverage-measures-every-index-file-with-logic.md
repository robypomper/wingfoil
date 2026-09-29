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

### red (developer)

`test/lint/coverage-scope.test.ts` (commit `a1508158`). It holds the barrel rule as a function,
`barrelViolations`, which parses a file with the TypeScript compiler API and lists every top-level
statement that is not a re-export (`export … from`), a type-only statement (`import type`,
`export type { … }`, interface, type alias) or an exported `const` with a string or number literal
initializer. It then checks `jest.config.js`: an include matches `src/core/index.ts` and
`src/mcp/index.ts` and no exclusion does (Node's `path.matchesGlob`); every exclusion is a literal
path with no glob character; every exclusion exists and has no violation. Seven cases pin the rule
itself (a function, a value import, a computed constant, a non-exported constant, a `let`, a class,
a bare expression are all logic).

The red is genuine. `npx jest test/lint/coverage-scope.test.ts` against the old configuration:
`Tests: 4 failed, 10 passed, 14 total`. The four failures are the two "measures" cases, the literal
path case, and the barrel case, which reports `src/**/index.ts: does not exist`. A first draft also
failed three rule cases because `ts.SyntaxKind[kind]` names `VariableStatement` as its alias
`FirstStatement`; the test names that kind explicitly. This was a test bug, fixed before the commit.

**AC 2 — barrel list, re-derived.** Method: the same `barrelViolations` function, compiled to a
scratch script and run over `find src -name index.ts | sort`. Result:

| File | Verdict | Why |
|---|---|---|
| `src/cli/index.ts` | barrel | `MODULE_NAME` only |
| `src/core/index.ts` | **logic** | 27 value imports, 7 functions, 22 computed `const`s (first at line 14) |
| `src/directives/index.ts` | barrel | |
| `src/dna/index.ts` | barrel | |
| `src/mcp/index.ts` | **logic** | 4 value imports (lines 62–65), `registerReadOnlyResources` (line 79) |
| `src/memory/index.ts` | barrel | |
| `src/storage/index.ts` | barrel | |
| `src/validation/index.ts` | barrel | no `MODULE_NAME`, re-exports only |
| `src/workflow/index.ts` | barrel | `MODULE_NAME` only |

This matches the Description. No `index.ts` exists below `src/*/` (the `find` lists only these
nine). The list stays checked: the test runs the rule on every exclusion at every `npm test`.

### green (developer)

`jest.config.js` (commit `d4d6f948`): `collectCoverageFrom` is `src/**/*.ts` plus seven literal
exclusions, one per barrel above. The comment above it says why barrels are excluded and why a
missing entry errs towards measuring. `npx jest test/lint/coverage-scope.test.ts` → `14 passed`.

### refactor (developer)

No code change was needed. Checks, all on the task branch after merging `main` (`cbb7381a`):

- `npx jest --coverage` → `Test Suites: 153 passed, 153 total`, `Tests: 2487 passed, 2487 total`,
  exit 0 (thresholds pass). Time 314 s, under load from parallel worktrees; no test flaked.
- `npm run lint` → exit 0. `npm run docs:api` → exit 0. `npx tsc --noEmit` → exit 0.

**AC 3 — coverage before and after** (statements / branches / functions / lines):

| Scope | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| Before (`!src/**/index.ts`) | 98.66% (3392/3438) | 94.26% (1789/1898) | 98.98% (584/590) | 99.47% (3000/3016) |
| After (seven barrels excluded) | 98.62% (3874/3928) | 94.18% (1993/2116) | 93.79% (650/693) | 99.47% (3398/3416) |
| For reference: no exclusion | 98.68% (4063/4117) | 94.18% (1993/2116) | 85.64% (722/843) | 99.49% (3527/3545) |

"After" is Jest's own `text-summary` from the `npx jest --coverage` run above. "No exclusion" is
the same from `npx jest --coverage --collectCoverageFrom='src/**/*.ts' --coverageReporters=json-summary
--coverageReporters=text-summary`, run on the unchanged branch. "Before" is computed from that run's
`coverage-summary.json` by summing the per-file covered/total counts of every file except
`src/*/index.ts`, which is exactly the old configuration's file set; Jest's global totals are the
same sums. That aggregation also gives exactly the "After" counts when only the seven barrels are
left out, which cross-checks the method.

Note that `src/cli/index.ts`, `src/directives/index.ts` and `src/workflow/index.ts` do not appear
in the no-exclusion report at all: no test loads them, and `roots` is `test/` only. That is
`bug-141`'s mechanism (v0.3), out of scope here.

**Per-file, the two index files** (same run):

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/core/index.ts` | 98.23% (444/452) | 93.57% (204/218) | 75.30% (61/81) | 99.46% (370/372) |
| `src/mcp/index.ts` | 100% (38/38) | 100% (0/0) | 22.72% (5/22) | 100% (28/28) |

The configured thresholds are global, and they pass. Per file, `functions` is below 80 for both.
Every uncovered function is a re-export getter thunk. Method: listing `fnMap` entries with a zero
count in `coverage-final.json` (`--coverageReporters=json`). In `src/core/index.ts` the 20 uncovered
functions sit on lines 96–165 and 556, which are all `export { … } from` lines. In `src/mcp/index.ts`
the 17 uncovered sit on lines 26–51 and 90, also re-exports; `registerReadOnlyResources` (line 79) is
covered. No function with a body in either file is uncovered, so no test was added: a test that
only reads each re-exported name would raise the number without testing any behaviour. Whether the
AC means the global or a per-file threshold is left to the approver.

The real gaps in `src/core/index.ts` are 8 uncovered statements (lines 193, 366, 698, 708, 1077,
1367, 1533, 1568) and 14 uncovered branch arms. All four of its metrics except `functions` are
above 80, so this task does not chase them.

### review (reviewer)

- AC 1 (red-first): met. `test/lint/coverage-scope.test.ts` failed 4/14 on the old configuration
  and passes 14/14 on the new one (commands above).
- AC 2 (characterization): met. Method and list above; the test re-checks the list at every run.
- AC 3 (characterization): met on the global thresholds, numbers above. The per-file `functions`
  figure is an open question for the approver, not a hidden gap.
- AC 4 (characterization): met. `npx jest --coverage` → 2487/2487 passed, 153 suites.
- BDD: there is no separate BDD runner (`package.json` `"test": "jest"`), and no `.feature` scenario
  covers the coverage file set. `grep -rli coverage docs/02_requirements/02_bdd/features/` returns
  only `P4.12-workflow-checks.feature`, which is about the workflow engine's `tests.coverage` check
  (not built). The full Jest run above is the acceptance evidence.
- Stale quote, not fixed here: `bug-141` (open, v0.3) quotes the old
  `collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts']` in its Summary. Closed v0.1/v0.2 task
  notes quote it too, and are historical records.
