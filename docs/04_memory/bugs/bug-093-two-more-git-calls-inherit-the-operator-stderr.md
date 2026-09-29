---
id: "bug-093-two-more-git-calls-inherit-the-operator-stderr"
type: bug
title: "`findElementCreationSha` and `walkGitLogFields` call `execFileSync` without `stdio`, so git's own diagnostics still reach the operator's terminal after `bug-071` is closed"
status: triaged
severity: "low"
release-origin: "v0.2"
release: ""
feature: "P1.10"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`bug-071` records that `readStatusAt` invoked `execFileSync` with no `stdio` option, so the child
inherited this process's stderr and git wrote straight to the operator's terminal. `task-097` fixed
that call. **Two others in the same history path were never given the option** and behave the same
way: `findElementCreationSha` (`src/memory/history.ts`) and `walkGitLogFields`
(`src/memory/git-log.ts`) both pass only `{ encoding: 'utf-8' }`.

## Steps to Reproduce

Not hypothesised — observed. While building `task-097`, the implementer's own new `git log` probe was
written without `stdio`, and the first otherwise-green run of
`npx jest test/memory/history-rename-path.test.ts` printed

```
fatal: not a git repository (or any of the parent directories): .git
```

into the test output. That is the same leak from a different call. The implementer added `stdio` to
its own probe before committing and proposed this element for the two it did not own.

To reach the remaining two, drive either function against a path that is not a git repository, or
against a revision in which the object does not exist.

## Expected Behavior

Every `git` invocation in the Memory pillar captures its child's stderr and turns a failure into a
handled result or a thrown error carrying the message. Nothing git writes reaches the operator except
through WingFoil's own output contract (`spec-005` §1, `spec-008`).

## Actual Behavior

Two calls inherit fd 2. A failure they are designed to tolerate — `walkGitLogFields` catches and
returns `[]`; `findElementCreationSha` throws — still emits git's raw text first.

## Notes

**Lower reach than `bug-071`, and that is the only reason it is `low`.** `readStatusAt` hit its case
on an ordinary `--follow` walk, which is why `bug-071` fired on clean runs. These two are reached
when the repository or the revision is wrong, which is rarer from the CLI. The defect is identical;
the exposure is not.

**It is the second half of a pattern worth naming rather than patching twice.** Three of the Memory
pillar's git calls were written without `stdio`, by different tasks, because nothing says they must
have it. A rule would have prevented all three; `task-097` fixed one and caught itself writing a
fourth. If a fix task takes this on, the cheap durable form is a single helper every Memory git call
goes through, rather than a third and fourth inspection of individual call sites.

**Found by `task-097`, which deliberately did not fix it** — its AC4 names `readStatusAt`, and
widening a task to the neighbours of its own fix is how scope stops meaning anything.

## Triage & Execution Notes

- triage (2026-09-24): **low**. No output is wrong, no exit code is wrong, and the reachable paths
  are error paths. It is filed rather than absorbed because `bug-071` closing may otherwise read as
  "the leak is gone", which is not true.
