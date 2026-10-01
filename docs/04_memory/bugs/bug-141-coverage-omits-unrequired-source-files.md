---
id: "bug-141-coverage-omits-unrequired-source-files"
type: bug
title: "A source file no test requires never appears in the coverage report, not even at 0%, because `roots` limits coverage discovery to what the tests load"
status: in-review
severity: "low"
release-origin: "v0.2"
release: "v0.3"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`jest.config.js` sets `roots: ['<rootDir>/test']`, together with a `collectCoverageFrom` that, when
this bug was filed, read `['src/**/*.ts', '!src/**/index.ts']`. **Updated 2026-09-29:** since
`task-122` (`bug-021`) it reads `src/**/*.ts` minus seven literal barrel paths, and
`src/core/index.ts` and `src/mcp/index.ts` are measured. The mechanism below is unchanged. Because
of `roots`, Jest reports coverage
only for the `src/` files that the executed tests actually load. A source file that no test requires
is **absent** from the report instead of appearing at 0%. So the global coverage figure, and the
`coverageThreshold` of 80%, are computed over a denominator that silently excludes it.

The defect is latent today. With the full suite, all 75 non-`index.ts` files under `src/` appear in
the report. The first file added without a test that loads it will be invisible to the coverage gate.
Two v0.2 tasks met the mechanism independently: `task-049` for `src/core/index.ts`, and `task-065`
for `src/cli/program.ts` and `src/cli.ts` before its own fix made them required.

This is distinct from `bug-021`. That bug covered the explicit `!src/**/index.ts` exclusion, and
`task-122` fixed it. After that fix, three of the seven excluded barrels (`src/cli/index.ts`,
`src/directives/index.ts`, `src/workflow/index.ts`) are loaded by no test, so this bug's mechanism is
what keeps them out of the report (`task-122` Execution Notes).

## Steps to Reproduce

Run at `a20b346c` plus the retrospective branch, from the repository root:

1. `npx jest test/memory/schema.test.ts --coverage --coverageReporters=json-summary --coverageDirectory=<tmp> --coverageThreshold='{}'`
2. `node -e "const s=require('<tmp>/coverage-summary.json');const k=Object.keys(s).filter(x=>x!=='total');console.log(k.length, k.some(x=>x.endsWith('src/cli/program.ts')))"`
   → `1 false`. One file is reported, and `src/cli/program.ts` is not listed at all, not even at 0%.
3. **Positive control.** With the full suite (`npx jest --coverage`), all 75 files listed by
   `find src -name '*.ts' ! -name 'index.ts'` appear in `coverage/coverage-summary.json`. Compared
   with `comm -23` on the two sorted lists (`LC_ALL=C`), nothing is missing.

## Expected Behavior

Every file matched by `collectCoverageFrom` appears in the report. A file no test loads shows 0%, so
the threshold counts it and a reviewer sees it.

## Actual Behavior

Only files loaded by the executed tests are reported. An unrequired file does not exist as far as the
report and the threshold are concerned.

## Notes

- **Candidate fixes.** Set `roots` to include `<rootDir>/src`, keeping `testMatch` restricted to
  `test/`, so coverage discovery walks `src/`. Or add a lint-gate test asserting that every
  `src/**/*.ts` file outside the declared exclusions appears in `coverage-summary.json`.
- **Surfaced by** the v0.2 retrospective's mining, from `task-049`'s and `task-065`'s Execution
  Notes (theme T3, gate blind spots), and reproduced as above.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (`retro-v0.2`). Severity is `low`, because the defect is
  latent at `a20b346c`: no source file is currently missing from the full-suite report.
