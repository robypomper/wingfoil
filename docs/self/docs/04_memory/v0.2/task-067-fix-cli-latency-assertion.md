---
id: "task-067-fix-cli-latency-assertion"
type: task
title: "Fix: P1.5's under-1-second budget must measure the query, not subprocess spawn contention"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "tooling", "quality-gate"]
ref: "P1.5"
bug: "bug-011-cli-latency-assertion-measures-spawn-contention"
depends_on: []
tmpl_version: 260703
---

## Description

`test/cli/program.integration.test.ts:352` implements BDD P1.5's *"And the query returns in under 1
second"* by wrapping `Date.now()` around a **spawned** `node dist/cli.js`. Under jest's default
parallelism that measurement is dominated by process startup and CPU contention from sibling workers,
so the primary test gate fails intermittently on an unmodified `main` (`bug-011`: reproduced at
`--maxWorkers=4`, green at `--maxWorkers=1`).

The budget itself is a real acceptance contract, so the fix must correct **what is measured**, not
delete the assertion.

## Acceptance Criteria

1. The P1.5 latency budget is asserted somewhere that measures the query rather than a process spawn —
   preferred: in-process around the core `memory search` operation (or `searchMemoryDocuments`),
   leaving `program.integration.test.ts` to assert exit code, output shape and content only.
2. `docs/02_requirements/02_bdd/features/p1-memory/P1.5-memory-search.feature`'s
   "Find a decision by keyword" scenario remains satisfied, including its under-1-second clause —
   the contract is preserved, only the measurement point moves.
3. The full suite passes at jest's **default** worker count, repeatedly. Concretely: three consecutive
   `npm test` runs on a loaded machine, all green. A single green run does not close this.
4. No test is deleted or skipped to achieve the above, and no timing assertion is simply widened to a
   number large enough to never fail — if a budget is kept in the integration test, it must be
   justified in the Execution Notes as measuring something meaningful.
5. Coverage ≥ 80; `npm run docs:api` exits 0; `npx eslint .` exits 0 (see `task-066`).

## Implementation Notes

Authorised alongside `task-066` by `dl-034-lint-gate-in-dev-loop` as part of the same recorded v0.2
exception; see that task's Implementation Notes for the reasoning and for why the two bugs get two
tasks rather than one.

**Not a duplicate of `bug-003-cli-integration-dist-race`** (closed): that was two suites racing on the
same `dist/`, fixed by building once in a jest `globalSetup`. This is a budget measured across a
process boundary inside a parallel runner — a different root cause in the same file.

Worth knowing while sizing this: every one of the ten v0.2 review agents hit this flake and each spent
effort classifying it, with several recording a stale "558/559" or "561/562" in their task's Execution
Notes as a result. The value here is mostly in what stops being re-derived.

## Execution Notes

<!-- Running log, filled in incrementally per phase. -->
