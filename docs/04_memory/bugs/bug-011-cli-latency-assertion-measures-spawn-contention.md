---
id: "bug-011-cli-latency-assertion-measures-spawn-contention"
type: bug
title: "P1.5's under-1-second assertion measures subprocess spawn contention, so npm test fails intermittently on a clean main"
status: closed
severity: "medium"
release-origin: "v0.1"
release: "v0.2"
feature: "P1.5"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`test/cli/program.integration.test.ts:352` implements BDD P1.5's *"And the query returns in under 1
second"* by wrapping `Date.now()` around a **spawned** `node dist/cli.js` invocation, so under jest's
default parallelism the measurement captures process startup plus CPU contention from sibling workers
rather than query latency — and the primary test gate fails intermittently on an unmodified `main`.

## Steps to Reproduce

1. Check out `main` at a clean working tree, on a machine where jest's default worker count is high
   (observed: 12 cores → `maxWorkers` 11).
2. Run the full suite under load: `npx jest --maxWorkers=4` (or plain `npm test`).
3. Repeat. Intermittently the run fails at `test/cli/program.integration.test.ts:352` with the
   `toBeLessThan(1000)` assertion; `npx jest --maxWorkers=1` passes.

## Expected Behavior

A clean `main` passes `npm test` every time. P1.5's latency contract should be measured on the thing
it is about — the query — not on the cost of booting a Node process while eleven sibling workers
compete for the CPU.

## Actual Behavior

Observed directly during the post-merge verification of `task-038`/`task-040`/`task-041`
(2026-09-14): at `--maxWorkers=4`, `1 failed, 571 passed, 572 total`, the failure being the
`under 1 second` assertion at line 352. The immediately preceding run at the same worker count, and
every `--maxWorkers=1` run, passed. Final merged `main` is `60 suites / 576 tests` green serialized.

## Notes

**Not a duplicate of `bug-003-cli-integration-dist-race`** (closed). That one was a genuine race — two
suites each `rmSync`-ing and rebuilding the same `dist/` — fixed by building once in a jest
`globalSetup`. This is a different root cause: the budget itself is measured across a process
boundary inside a parallel runner.

**The assertion is not gratuitous.** `P1.5-memory-search.feature` line 12 specifies *"And the query
returns in under 1 second"*, so the test is faithfully implementing an acceptance contract. The defect
is in *what is measured*, not in the existence of the budget — which is why the fix must not simply
delete the assertion.

Candidate fixes, in rough order of preference:

1. Measure in-process: assert the budget around the core `memory search` operation (or
   `searchMemoryDocuments`) rather than around a spawned CLI, leaving the integration test to assert
   exit code and output only. This measures the query, which is what P1.5 is about.
2. Exclude spawn overhead: keep the subprocess test but measure only the CLI's own self-reported
   elapsed time (requires the CLI to report it), or subtract a measured baseline spawn.
3. Serialize the suite (`test/cli/*` in a `runInBand`-style project) — cheapest, but it slows the
   suite and leaves the measurement conceptually wrong.

**Why this matters beyond one red test:** every one of the ten v0.2 review agents hit this and each
had to spend effort re-deriving that it was a pre-existing flake rather than a regression on its own
branch; several recorded a stale "558/559" or "561/562" in their task's Execution Notes as a result. A
non-deterministic gate on a project whose north star is determinism costs more than the test is worth.

## Triage & Execution Notes

- capture (`bug-ingest`): found during the merge verification that followed the v0.2 review gate, not
  during the review itself — captured under the same phase plan
  (`bug-ingest-rel-v0.2-review-findings-plan`), which named only `bug-009`/`bug-010` at authoring
  time. Reproduced on `main` at `--maxWorkers=4` and shown green at `--maxWorkers=1`.
  Severity `medium`: no runtime defect, but it makes the project's primary quality gate unreliable.
