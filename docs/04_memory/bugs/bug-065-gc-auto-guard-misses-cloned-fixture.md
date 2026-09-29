---
id: "bug-065-gc-auto-guard-misses-cloned-fixture"
type: bug
title: "`gc.auto=0` never reaches the repository `cloneTempRepo` produces, while the test asserting it is titled \"every fixture repo\""
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

`task-082` disabled git auto-gc in fixture repositories so that no detached `git gc` could outlive a
fixture and hold `.git` open during teardown. The setting is applied where a repository is
initialised, but `git clone` does not inherit it, so the repository produced by `cloneTempRepo` keeps
git's 6,700-object default. The test that pins the behaviour is titled *"disables git auto-gc in
every fixture repo, so no detached gc can outlive the fixture"* — a claim broader than what it
checks.

## Steps to Reproduce

```
$ git init -q src && git -C src config gc.auto 0 && git -C src commit -q --allow-empty -m x
$ git clone -q src dst
$ git -C src config --get gc.auto   # 0
$ git -C dst config --get gc.auto   # (no output — the key is absent)
```

Run on 2026-09-22. `cloneTempRepo` (`test/storage/helpers/git-fixture.ts`) produces exactly this
shape: a `git clone` into a fresh temp directory, with no `git config` applied to the result.

## Expected Behavior

Either every fixture repository has auto-gc disabled — including the cloned one — or the test that
asserts it names only the repositories it actually covers.

## Actual Behavior

The cloned fixture keeps the default, and a passing test reads as if it did not. A future reader
debugging a teardown race in a clone-based fixture would consult that test, see auto-gc "disabled in
every fixture repo", and eliminate the right hypothesis for the wrong reason.

## Notes

The practical risk today is small and should not be overstated: `task-082` measured that auto-gc was
**not** the mechanism behind `bug-058` in the first place — a rebuilt 1,000-document fixture carries
roughly 1,006 loose objects against the 6,700 threshold, and no gc process was observed — so this gap
closes a path that has never been seen to fire. What makes it worth filing is not the gc risk but the
**false generality of the assertion**, which is the same failure this release has been rejecting all
along: a claim about state that nobody re-derived, this time embedded in a test name where it reads
as verified.

Two smaller items found by the same review belong in this fix rather than in elements of their own,
because they are one pass over the same file:

- The retry budget added by `task-082` has **no test coverage**: removing `maxRetries`/`retryDelay`
  from `removeTempDir` turns nothing red. No acceptance criterion asked for it, and the `rmSync` mock
  is already in hand, so one `toHaveBeenCalledWith` assertion pins it.
- The concurrent-writer test's own `finally` calls `rmSync` unguarded, i.e. the teardown helper it
  exists to test is not what cleans up after it.
- The TSDoc on the retry budget says a removal "can spend at most ~300ms fighting a concurrent
  writer". That is the sleep budget, not elapsed time; the real helper was measured at up to 1021 ms,
  the remainder being the recursive walk. The Execution Notes state this correctly — only the TSDoc
  is loose.

Related: `bug-064-fixture-temp-dirs-leak-with-no-aggregate-visibility` is the other defect in the
same helper, kept separate because it is about directories surviving rather than about a guard's
reach.

## Triage & Execution Notes

- triage (2026-09-22): **low**. Nothing fails, and the path the guard misses has never been observed
  to fire. The cost is a misleading test name plus three small omissions in the same file.
- No fix task filed: one pass over `test/storage/helpers/git-fixture.ts` and
  `test/storage/git-fixture-teardown.test.ts` covers this and `bug-064` together. Natural v0.3 item.
