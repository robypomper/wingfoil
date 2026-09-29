---
id: "bug-070-cli-integration-helpers-fabricate-empty-stderr"
type: bug
title: "Two CLI integration helpers return a hardcoded `stderr: ''` on the success path, so every assertion that a passing command printed nothing to stderr asserts a literal the helper wrote itself"
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

`test/cli/fresh-init-transitions.test.ts` and `test/cli/journey-0a.integration.test.ts` each wrap the
compiled CLI in a helper that runs it with `execFileSync` inside a `try`, and on the non-throwing path
returns `{ status: 0, stdout, stderr: '' }` — a literal, not the process's actual stderr, which
`execFileSync` never captured. Every `expect([run.status, run.stderr]).toEqual([0, ''])` in those
suites therefore compares the helper's own constant against itself. A command that exits `0` while
printing a `fatal:` to stderr passes.

## Steps to Reproduce

```
$ grep -n "stderr: ''" test/cli/fresh-init-transitions.test.ts test/cli/journey-0a.integration.test.ts
test/cli/fresh-init-transitions.test.ts:65:    return { status: 0, stdout, stderr: '' };
test/cli/journey-0a.integration.test.ts:56:    return { status: 0, stdout, stderr: '' };
```

Read on `main` at `e933f53`. Both helpers return the literal only on the success path; on the error
path they surface the real stderr from the thrown error, which is why the weakness is invisible —
the assertions that matter most, the ones on commands expected to succeed, are the vacuous ones.

## Expected Behavior

A helper that reports `stderr` reports what the process actually wrote, so an assertion that a passing
command was quiet can fail.

## Actual Behavior

The assertion cannot fail. This is not a hypothetical: `bug-071` records that `memory history` prints
`fatal: path '<doc>' exists on disk, but not in '<sha>'` on every run, including clean ones, at exit
`0` — precisely the shape these assertions exist to catch and cannot.

## Notes

**Found from the other side.** `task-086-fix-reason-control-chars-history-forgery` wrote a new
integration helper with `spawnSync` rather than `execFileSync` + `catch`, deliberately, because the
latter gave it a **false green against code it knew to be broken** — the forged history printed a
`fatal:` that the helper never saw. Its reviewer then checked whether the siblings shared the
weakness. They do, across many assertions in two suites.

The fix is the one `task-086` already demonstrated: `spawnSync` captures both streams on every path,
success included. Both helpers are a handful of lines, and `task-086`'s helper documents why in its
own comment, so the pattern to copy already exists in the repository.

Worth keeping in view when this is scheduled: the point is not that these two suites are wrong today,
but that a whole class of assertion in them is **incapable of failing**. Counting them is part of the
fix — a passing assertion that could never fail is worse than an absent one, because it reads as
coverage.

## Triage & Execution Notes

- triage (2026-09-22): **medium**. Nothing is currently broken *by* it, but it silently removes the
  guard from two integration suites, and the defect it would have caught is real and open
  (`bug-071`). Not high because the suites' other assertions — exit status and stdout content — do
  work, so the coverage loss is partial.
- No fix task filed: it is a few lines in two files and a natural companion to whatever next touches
  those suites, or to `bug-071`'s fix, which is the defect they should have caught.
