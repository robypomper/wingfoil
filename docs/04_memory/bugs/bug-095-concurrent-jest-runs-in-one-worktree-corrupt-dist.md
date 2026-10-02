---
id: "bug-095-concurrent-jest-runs-in-one-worktree-corrupt-dist"
type: bug
title: "Two `npx jest` runs in one worktree delete and rebuild each other's `dist/`, producing a convincing false failure that vanishes on re-run"
status: closed
severity: "medium"
release-origin: "v0.2"
release: "v0.3"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`test/global-setup.cjs` removes `dist/` and rebuilds it at the start of every jest run, with **no
lock**. Two runs in the same worktree therefore race: the second deletes the build the first is
executing against. The first reports failures that are real observations of a missing or half-written
`dist/`, and they vanish on a solitary re-run.

`bug-003` fixed the *intra*-run version of this — a parallel-suite race over `dist/` — by building
once in `globalSetup`. That fix covers suites **within** a run and says nothing about runs.

## Steps to Reproduce

Observed on 2026-09-24 during `task-093`'s third pass, not constructed afterwards.

1. Start `npx jest` in a worktree.
2. While it is running, start a second `npx jest` in the same worktree.
3. The first reports failures — in the observed case **3 suites / 48 tests**.
4. Re-run alone (`pgrep -fa jest` clean first): **2114 passed**. Three further solitary runs agreed.

## Expected Behavior

A jest run either takes a lock on the build and serialises, or builds into a run-scoped directory, so
that a concurrent run cannot make another one lie. Failing that, the run refuses to start with a
message naming the other run, which is far better than a false failure.

## Actual Behavior

The losing run reports ordinary-looking test failures with no indication that its build was removed
underneath it. Nothing in the output points at the cause.

## Notes

**The cost is not the failure, it is the belief.** The output is indistinguishable from a genuine
regression, so the natural response is to start debugging the change under test. This release has
several agents working in parallel and reviewers re-running gates in the same worktree an implementer
just used, which is exactly the shape that triggers it.

**It also interacts with how this release verifies claims.** The standing rule is to run the command
that settles a claim and put the command in the note. If the command can lie under concurrency, a
correctly-followed rule still produces a false note — and the note will carry the command, making it
look well-evidenced.

**Predates `task-093`**, which found it and did not fix it: `test/global-setup.cjs` is shared
infrastructure and the task owned the DNA surface. It also has no clean owner among the current
tasks, which is why it is filed rather than absorbed.

**Workaround, which is what the wave briefs now say:** one jest run per worktree at a time; check
`pgrep -fa jest` before starting; never conclude from a single failing run.

## Triage & Execution Notes

- triage (2026-09-24): **medium**. No shipped behaviour is wrong and no user can hit it — it is a
  developer-experience defect in the test harness. It is not low because it manufactures false
  evidence in a project whose review process is built on running commands, and because the parallel
  worktree workflow (`dl-014`, `dl-035`) makes the collision ordinary rather than exotic.
- Not scheduled to v0.2: nothing about the release is wrong, and the workaround is a one-line habit.
