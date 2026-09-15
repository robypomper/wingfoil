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

### `design` (architect) — AC classification, `depends_on`, spec verification

**`agent.read_related` (dl-015) — no-op.** `depends_on: []`, so there are no upstream Execution Notes
to load or acknowledge. Recorded explicitly so the hard gate is visibly satisfied rather than skipped.

**`agent.classify_acs` (T1, dl-014 + `testing` directive).**

| AC | Classification | Why |
|----|----------------|-----|
| 1 — budget asserted where it measures the query, not a spawn | **split: characterization + red-first** | The *in-process* half already exists: `test/core/query-latency.test.ts` benchmarks the **registered** `memory.memorySearch` `CoreFn` (the exact call `wingfoil memory search` makes) at p95 over 25 runs on the 1,000-document reference repository — put there by task-008 and re-pointed at the registered op by task-021. So "a meaningful measurement point exists" is *characterization*. What does **not** exist is anything that stops the meaningless one from coming back: `test/cli/program.integration.test.ts:352` wraps `Date.now()` around a spawned `node dist/cli.js`, and nothing forbids it. That regression guard is the **red-first** piece. |
| 2 — P1.5 "Find a decision by keyword" (incl. the under-1-second clause) still satisfied | **characterization** | Both halves of the scenario already pass today; the work is to bind them to the honest measurement point and make the binding traceable, not to add behaviour. The 1,000-doc benchmark currently searches a synthetic `benchmarktoken`, so the *scenario's own* fixture ("a document titled `API design` tagged `architecture`", query `api`) is not what gets timed — that gap is closed by fixture wiring, not by new production code. |
| 3 — three consecutive full `npm test` runs green at default workers | **characterization (verification)** | Pure observation of the tree after the fix; no test can assert "I was run three times". Evidence is recorded in the `refactor`/`review` notes below. |
| 4 — nothing deleted/skipped, no budget merely widened | **not a test-bearing AC (constraint on the change)** | Verified by inspection of the diff + the suite counts, recorded below. Numerically: no threshold anywhere moves — `1000` stays `1000`. |
| 5 — coverage ≥ 80, `docs:api` 0, `eslint` 0 | **characterization (gate)** | Existing project gates; this task must not regress them. `eslint` has one **pre-existing** error owned by `task-066` (see Deviations). |

**`agent.verify_specs` — no new `tech-spec` needed, none scaffolded.** The question the gate asks here
is: *does a tech-spec govern where a performance budget is asserted, and is one missing?* Answer: the
rule is already specified, in two places that are authoritative and non-overlapping, so a third
document would duplicate rather than fill a gap:

- **`docs/02_requirements/03_sard/02_performance-nfr.md`** already defines both the threshold and the
  *measurement conditions* for this exact budget — REQ-PERF-02 pins `wingfoil memory search` at
  **< 1,000 ms (p95)**, evaluated as **p95 over ≥ 20 runs on a 1,000-document reference repository**,
  and its preamble states outright that those conditions are defined by the requirement and are *not*
  asserted by the BDD scenario, which fixes only the threshold. That is precisely the "where/how is a
  latency budget measured" contract, and `test/core/query-latency.test.ts` already implements it.
- **The `testing` directive** ("Tests are deterministic and isolated; no reliance on external services
  or wall-clock/random") plus the **`determinism`** directive supply the rule the new guard encodes.

The 15 existing specs (`spec-001`…`spec-015`) are artefact/format/API contracts (`memory.yaml` schema,
CLI grammar, core domain API, MCP surface, packaging…); none is a test-strategy spec, and this task
introduces no new file format, schema, constant set, or module API that would need one — it changes
**test code only**. Scaffolding a `spec-016-performance-budget-placement` would restate REQ-PERF-02
and the `testing` directive in a third voice, creating exactly the kind of drift the traceability
directive warns about. **Design therefore passes through with no approval gate** (per `dev-loop.yaml`
`approval: { by_role: approver }` — "only when a new spec was scaffolded").

**Design decision — where the budget moves, and what guards it.**

1. `test/cli/program.integration.test.ts`'s P1.5 case keeps asserting exit code, output shape and
   content, and **drops** the `Date.now()` wrapper. Removing an assertion that measures the wrong
   quantity is not weakening the contract — the quantity it measured (process startup + sibling-worker
   CPU contention) was never the one P1.5 names.
2. `test/core/query-latency.test.ts` — REQ-PERF-02's home — takes over the P1.5 scenario **literally**:
   the reference repository gets the BDD Background document (titled `API design`, tagged
   `architecture`) as one of its existing 1,000 documents, and a new timed case runs the scenario's own
   query (`memory search api`) through the registered `memory.memorySearch` op, asserting both halves
   of the scenario — results include `API design`, p95 < 1,000 ms. Stronger than the deleted assertion
   on every axis: it measures the query rather than a spawn, at 1,000-document scale rather than 2,
   over 25 runs at p95 rather than a single sample.
3. New guard `test/core/latency-budget-placement.test.ts` — no test file under `test/cli/` (the
   spawn-based suites, by construction: each case shells out to `cli-harness.cjs`) may read the wall
   clock. This is the red-first piece and the part that stops bug-011 from being re-derived; it lives
   in `test/core/` alongside the other cross-cutting structural guards (`module-layout`,
   `pillar-isolation`, `parity`) and therefore is not itself in the scanned set.

**Files deliberately not touched (concurrent tasks):** `test/storage/git-backed-storage.test.ts` and
`docs/self/.wingfoil/workflows/custom/dev-loop.yaml` (task-066); `src/memory/query.ts`,
`test/memory/query.test.ts`, `test/core/memory-search.test.ts` (task-035's
`isDeprecatedStatus` → `isArchivedStatus` rename). `test/core/query-latency.test.ts` is in none of
those sets and references no renamed symbol, so extending it is conflict-free.
