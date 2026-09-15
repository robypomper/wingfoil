---
id: "bug-009-eslint-baseline-require-imports"
type: bug
title: "`npm run lint` fails on main, so every branch inherits a red lint gate that masks newly-introduced errors"
status: resolved
severity: "medium"
release-origin: "v0.1"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`npx eslint .` exits non-zero on `main` with one `@typescript-eslint/no-require-imports` error in
`test/storage/git-backed-storage.test.ts:90`, so the lint gate has been red since v0.1 and cannot
distinguish a clean branch from one that added errors.

## Steps to Reproduce

1. Check out `main` at a clean working tree.
2. Run `npx eslint .` (or `npm run lint`).
3. Observe exit code 1.

## Expected Behavior

`npm run lint` exits 0 on `main`. The `code-quality` directive requires it explicitly: *"Lint clean:
no errors; warnings triaged before merge."* A green baseline is what makes a newly-red gate mean
something.

## Actual Behavior

```
/…/test/storage/git-backed-storage.test.ts
  90:5  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

✖ 1 problem (1 error, 0 warnings)
```

Introduced with the file itself, in `task-018-implement-git-backed-storage` (`7892282`).

## Notes

The cost is not the error, it is the lost signal — and that cost has already been paid once. During
the v0.2 review sweep, `task-043-secret-credential-hygiene` added **four** further
`no-require-imports` errors in its own test file while its Execution Notes recorded "ESLint clean";
the gate went from 1 error to 5 without ever changing state from red to red. Seven of the ten
reviewers independently had to re-derive that the single remaining error was pre-existing in order to
judge their own branch, which is work the gate should have done for them.

Suggested fix: replace the `require()` call at `test/storage/git-backed-storage.test.ts:90` with a
top-of-file ES import, matching the rest of that file. Worth pairing with a CI job that runs
`npm run lint`, so the baseline cannot silently go red again — `adr-009` (GitHub Actions CI/CD,
`accepted`) is the natural home.

Scheduling note: fixing this **before** the four tasks returned to `red` by the v0.2 review gate are
resubmitted would make those resubmissions verifiable against a green baseline.

## Triage & Execution Notes

- capture (`bug-ingest`, plan `bug-ingest-rel-v0.2-review-findings-plan`): found by the `dev-loop`
  review gate over `task-034`..`task-044`; reproduced directly on `main`, not inferred from a branch.
  Severity `medium` — no runtime impact, but it disables a quality gate the directives mandate.
