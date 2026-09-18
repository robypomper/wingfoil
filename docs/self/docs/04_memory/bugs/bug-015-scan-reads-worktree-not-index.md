---
id: "bug-015-scan-reads-worktree-not-index"
type: bug
title: "scanProjectSurface enumerates the git index but reads the working tree, so a staged deletion throws ENOENT instead of reporting"
status: closed
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`scanProjectSurface` builds its file list from `listTrackedFiles` — which enumerates the **git index**
— then reads each path with `readFileSync(join(root, relPath))`, which reads the **working tree**. A
path tracked in the index but absent from disk makes the scan throw `ENOENT` instead of returning a
result.

## Steps to Reproduce

1. In a repo with a memory document under a scanned surface root, delete the file on disk without
   staging the deletion (`rm docs/self/docs/04_memory/bugs/bug-001-cli-version-flag.md`).
2. Call `scanProjectSurface(repoRoot)`.
3. It throws `ENOENT` rather than producing a `ScanResult`.

## Expected Behavior

A file listed in the index but missing from the working tree is skipped, or reported as a scan
diagnostic — but does not abort the whole scan. The two sources should be reconciled deliberately:
either enumerate and read the same thing, or handle the gap explicitly.

## Actual Behavior

Unhandled `ENOENT` propagates out of `scanProjectSurface`, taking down every caller — including
`test/validation/secret-scan.test.ts`'s REQ-SEC-08 Fit-Criterion case, which scans the real repository
root, so the **entire test suite** fails rather than one assertion.

## Notes

Latent today and harmless in a clean checkout, which is why it survived two review passes. It stops
being latent at the call site the scanner is built for: a commit-time or pre-publish gate runs against
a working tree where staged deletions are ordinary, and `task-044`/`task-057`/`task-061` are the
plausible consumers.

Raised by `task-043`'s second-pass review. The same review noted the related wording point: the
Fit-Criterion test's `describe` says "this repository's own **committed** surface", while the verdict
is actually a function of working-tree content at indexed paths. `task-043`'s Execution Notes state
this honestly; only the test title overstates. A fix here should reconcile the title too.

Suggested direction: decide whether the scanner's contract is "what is committed" (read blobs via
`git show :path` / `git cat-file`) or "what is on disk at tracked paths" (current behaviour, with an
existence guard). The first is the stronger guarantee for a pre-commit gate; the second is cheaper.
Either way the `describe` title and the TSDoc should say which.

## Triage & Execution Notes

- capture (`bug-ingest`): raised by `task-043`'s second-pass review.
