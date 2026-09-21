---
id: "bug-022-npm-pack-prepack-rebuilds-dist"
type: bug
title: "npm-distribution.test.ts runs npm pack without --ignore-scripts, rebuilding the shared dist/ mid-suite"
status: in-review
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`test/cli/npm-distribution.test.ts:117` calls `npm pack --dry-run --json` **without**
`--ignore-scripts`, so npm runs the `prepack` hook — `npm run build` → `tsc -p tsconfig.build.json` —
which writes `dist/` while other jest workers are spawning `node dist/cli.js`.

## Steps to Reproduce

1. `npx jest --maxWorkers=4`
2. `test/cli/npm-distribution.test.ts` reaches its `npm pack` call.
3. `tsc` rewrites `dist/` while a concurrent subprocess suite is executing from it.

## Expected Behavior

The suite inspects the packed file list without mutating the shared build output — the way its
sibling already does: `test/cli/publish-metadata.test.ts:79` calls the same command **with**
`--ignore-scripts`, and its header comment says why.

## Actual Behavior

`dist/` is rebuilt mid-run, defeating the single-build `globalSetup` introduced for `bug-003`.

## Notes

Same class as **`bug-003`** (closed), in a different disguise: bug-003 was scoped to the
`rmSync(dist) + tsc` form in a `beforeAll`. Risk here is lower — an overwrite, not a delete — but it
is a live flake source at `--maxWorkers>1` and it is currently unowned.

Fix is one argument: add `--ignore-scripts`, matching the sibling suite.

## Triage & Execution Notes

Raised from `task-065`'s dev-loop review (v0.2). Severity `low`.
