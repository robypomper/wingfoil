---
id: "bug-021-core-index-excluded-from-coverage"
type: bug
title: "collectCoverageFrom hides src/core/index.ts, which holds real core-operation logic"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`jest.config.js`'s `collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts']` excludes
`src/core/index.ts` — which is not a barrel but the file holding every registered operation's `fn`
body — so real logic is absent from the coverage gate that `dev-loop`'s `refactor` step enforces.

## Steps to Reproduce

1. `npx jest --coverage`
2. Observe `src/core/index.ts` does not appear in the report.
3. Re-run with `--collectCoverageFrom 'src/**/*.ts'` (no exclusion) and observe it reports
   `97.71 / 93.18 / 85.29 / 98.64` (stmts/branch/funcs/lines) — i.e. it is not fully covered.

## Expected Behavior

A file containing operation logic is measured by the coverage gate.

## Actual Behavior

It is excluded by a glob whose evident intent was "skip re-export barrels".

## Notes

**Originally disclosed by `task-049-memory-history`** (lines 195-204 of its Memory file) and left in
Execution Notes. `task-049` is now `done`, so it escaped once; `task-050` and `task-065` have each
restated it since. That recurrence is the reason this is an element rather than a third note.

**A second, broader mechanism** was measured during `task-065`'s review and belongs here: jest
discovers untested files by crawling `roots`, which is `test/` only, so **any `src/` file that no
test requires is absent from the report entirely — not reported as 0 %.** At baseline `d933cbe`
exactly two files were invisible this way (`src/cli/program.ts`, `src/cli.ts`); `task-065` closed
both, so head has **zero**. Still latent for `src/cli/index.ts`, `src/directives/index.ts`,
`src/workflow/index.ts` — all genuinely re-export-only.

**The reported ~98 % is NOT materially overstated**, which was checked rather than assumed. Re-running
head coverage with the exclusion removed moves statements 98.18 → 98.30, branches 89.75 → 90.07 and
lines 98.90 → 98.95 — all **up**. Only functions drops, 98.40 → 81.64, and that is an artifact:
compiling a barrel such as `src/dna/index.ts` to CommonJS turns 36 lines of pure re-exports into 19
`Object.defineProperty(exports, …, { get: … })` thunks, each counted by istanbul as an uncovered
function.

So the fix is narrow: exclude only true barrels (or list them explicitly) rather than every
`index.ts`, and optionally add `src` to coverage discovery so an unrequired file reports 0 % instead
of vanishing. Behaviour in `src/core/index.ts` is in fact well covered by other means — `task-050`
alone drives 12 core cases and 4 compiled-CLI cases through it — so this is a **measurement-reporting**
gap, not a testing gap.

## Triage & Execution Notes

Raised from the `task-050` and `task-065` dev-loop reviews (v0.2). Severity `low`: no defect ships as
a result, but the gate under-reports and the omission has now survived three disclosures.
