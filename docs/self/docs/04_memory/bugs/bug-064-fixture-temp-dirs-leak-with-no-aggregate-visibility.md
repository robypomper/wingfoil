---
id: "bug-064-fixture-temp-dirs-leak-with-no-aggregate-visibility"
type: bug
title: "`cloneTempRepo` leaks two temp directories per call and nothing counts them, so fixture leaks — including `removeTempDir`'s new give-up path — are visible only as console noise"
status: open
severity: "medium"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`cloneTempRepo` in the storage test fixture creates **two** `mkdtemp` directories per call — one to
hold the clone destination, one to act as the clone's working directory — and removes neither. What
callers receive is the `clone` subdirectory of the first, so the `removeTempDir` they run in teardown
cannot reach either parent. Nothing in the suite counts, sweeps or reports leftover fixture
directories, so the leak is invisible until somebody lists the system temp directory by hand.

## Steps to Reproduce

```
$ ls -d /tmp/wf-storage-* | wc -l
0
$ npx jest test/storage/snapshot.test.ts
Tests: 6 passed, 6 total
$ ls -d /tmp/wf-storage-* | wc -l
2
```

Six tests in one file leave two directories behind. Run on 2026-09-22 against `main` `7e4146e`.
The leaking code is `cloneTempRepo` in `test/storage/helpers/git-fixture.ts`, whose two
`mkdtempSync(join(tmpdir(), 'wf-storage-clone-'))` / `…'wf-storage-cwd-'…` calls have no matching
removal anywhere.

## Expected Behavior

A fixture helper removes what it creates, and a test run that leaves temporary state behind says so
once, in a number, rather than not at all.

## Actual Behavior

Every `cloneTempRepo` call leaks two directories permanently. Separately, `removeTempDir`'s give-up
path — added by `task-082` so that a teardown failure can never fail a passing test — reports itself
with `console.warn` and nothing else: no counter, no aggregate, no end-of-run check.

## Notes

**Measured, with the measurement's own limit stated.** The reviewer of `task-082` found **946**
directories in `/tmp` on 2026-09-21 — 473 `wf-storage-clone-` and 473 `wf-storage-cwd-` — the oldest
dating to 2026-09-17, five days of silent accumulation. That exact count is **not reproducible
today**: `/tmp` is empty of them as of 2026-09-22, cleared between the two dates by something outside
this repository (a reboot or the system's own temp sweep). That does not weaken the finding and
should not be read as the leak being fixed — the fresh reproduction above shows the leak is live —
but the number 946 belongs to a moment, not to now, and is recorded as such.

The five-day accumulation is the real evidence, and it is evidence about **visibility**, not just
about disk: `console.warn` is the mechanism `task-082`'s design now depends on to surface a teardown
that gave up, and 946 undetected directories are the measurement of how well console output surfaces
this class of thing.

This bug is the reason `task-082`'s approval records it as a mitigation rather than a repair
(`f99c395`), and it is filed as a bug rather than a decision-log because both halves are determinate:
a helper that does not remove what it creates is a defect with one right answer, and the absence of
any aggregate count is not a question of preference. The shape of the fix, on the other hand, is
worth stating as a candidate rather than a requirement — the repository already wires
`test/global-setup.cjs` as jest's `globalSetup`, so a `globalTeardown` sibling that sweeps
`os.tmpdir()` for the fixture prefix and prints one count line is cheap, deterministic and
worker-safe. Whether it should also **fail** the run above a threshold is the one genuinely open
sub-question here.

Related: `bug-065-gc-auto-guard-misses-cloned-fixture` is the other defect in the same helper found
by the same review, and is deliberately kept separate — it is about a guard not reaching the clone,
not about the clone's directories surviving.

## Triage & Execution Notes

- triage (2026-09-22): **medium**. It wastes disk indefinitely on every developer machine and CI
  container, and — more importantly — it demonstrates that the visibility mechanism `task-082` relies
  on does not work. It is not high because nothing fails: no test, no gate and no release is blocked
  by it, and the directories are small.
- No fix task filed yet. Both halves are small and belong together with `bug-065` in one pass over
  `test/storage/helpers/git-fixture.ts` plus one new `globalTeardown`; that pass is a natural v0.3
  item unless the approver wants it inside v0.2.
