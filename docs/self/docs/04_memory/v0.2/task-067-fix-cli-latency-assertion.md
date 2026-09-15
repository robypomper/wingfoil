---
id: "task-067-fix-cli-latency-assertion"
type: task
title: "Fix: P1.5's under-1-second budget must measure the query, not subprocess spawn contention"
status: approved
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

### `red` (developer) — the guard that makes the flake unrepeatable

New `test/core/latency-budget-placement.test.ts`: **no test-suite file may both start a child process
and read the wall clock.** Textual scan of every `.ts`/`.cjs` under `test/` (the file excludes itself;
see its module doc), spawn markers `child_process`/`execFileSync`/`execSync`/`spawnSync` against clock
markers `Date.now(`/`performance.now(`/`process.hrtime`. It is the *combination in one file* that
reproduces bug-011 — the in-process timing suites (`query-latency`, `mcp/resource-latency`,
`mcp/server`) never spawn, and the spawn-based CLI suites had no business reading a clock.

Observed red, verbatim (`npx jest test/core/latency-budget-placement.test.ts`):

```
  ● bug-011 — latency budgets are measured in-process, never across a process spawn ›
    test/cli/program.integration.test.ts does not wrap a wall-clock measurement around a spawned process

    - Array []
    + Array [
    +   "Date.now(",
    + ]

Tests:       1 failed, 64 passed, 65 total
```

Exactly one failure, naming the offending file and the exact API — no fabricated red, no dead code
added to force one. The other 64 scanned files passed on the first run.

### `green` (developer) — the budget moves, the threshold does not

1. `test/cli/program.integration.test.ts` — the P1.5 case drops the wall-clock wrapper and keeps exit
   code, output shape and content. A comment records why, and where the clause went.
2. `test/core/query-latency.test.ts` — the reference repository's document **750** becomes P1.5's
   Background document: `adr-050-doc`, titled `API design`, tagged `architecture`. That index was
   chosen, not stumbled into — it has a globally unique id (`task-*` ids repeat across the seven
   release directories), the `index % TAGS.length` rotation already gives it `architecture`, and it is
   neither a `benchmarktoken` metadata hit (`750 % 13 ≠ 0`) nor a body hit (`750 % 7 ≠ 0`), so the
   pre-existing keyword benchmark's match statistics are untouched and the document count stays at
   exactly 1,000. A new case then runs the scenario's own query through the **registered**
   `memory.memorySearch` op and asserts both of its `Then` clauses.

**Measured, not assumed.** With a temporary `console.log` around the new assertion (added, read, and
reverted before committing — it is not in the tree): **p95 = 63.3 ms, min 24.4 ms, max 66.5 ms** over
25 runs on the 1,000-document repository. Roughly 16x headroom under the unchanged 1,000 ms budget,
which is what a latency assertion should look like when it measures the right thing — versus the
single spawn sample it replaces, which sat close enough to 1,000 ms to flip on worker contention.

**Commit-subject deviation (plan §2).** The table maps `green` to `feat({module})`; this is a bug-fix
task, so the honest verb is `fix`, and the module is `cli` — bug-011's location and the task's own
name. The commit also carries the `test/core` half, because removing the meaningless assertion and
adding the meaningful one are one logical change that must not be separable (splitting them would put
a commit in history where P1.5's timing clause is asserted nowhere).

### `refactor` (developer) — gates

No code refactor was needed: the `green` change is test code, already at its final shape, and
inventing a `refactor()` commit to satisfy the table would be noise. **There is therefore no
`refactor({module})` commit for this task** — this notes entry is the phase's record.

| Gate | Result |
|------|--------|
| `npm run test:coverage` | exit **0** — 61 suites / **642** tests passed; statements **97.96**, branches **88.22**, functions **97.65**, lines **98.38** — all ≥ 80 |
| `npx tsc -p tsconfig.build.json` | exit **0** |
| `npm run docs:api` | exit **0** (TypeDoc `notDocumented` + `treatWarningsAsErrors`, hard-reject regime) |
| `npx eslint .` | exit **1**, **exactly 1 error** — `test/storage/git-backed-storage.test.ts:90 A require() style import is forbidden`. Identical to the baseline measured on this branch *before* any edit: pre-existing, `bug-009`, owned by **task-066**. This task introduced **zero** new lint findings (see Deviations). |

**AC-3 — three consecutive full `npm test` runs at jest's default worker count.** `--showConfig`
reports `"maxWorkers": 11` on this 12-core machine, i.e. the exact parallelism bug-011 reproduced
under. All three green, no retries, nothing skipped:

| Run | Result | Time |
|-----|--------|------|
| 1 | exit 0 — 61 suites / 642 tests passed | 21.403 s |
| 2 | exit 0 — 61 suites / 642 tests passed | 17.959 s |
| 3 | exit 0 — 61 suites / 642 tests passed | 19.632 s |

Plus two runs at bug-011's documented repro condition `npx jest --maxWorkers=4` — the setting that
*did* fail on a clean `main` — both exit 0, 61/642, 19.956 s and 19.224 s.

**On the counts.** 642 tests, not the "558/559"/"561/562" figures that circulated during the v0.2
review gate. I did **not** re-measure the pre-edit baseline on this branch — but the arithmetic
reconciles exactly against the 60 suites / 576 tests recorded for `main` after
`task-038`/`040`/`041`. This task adds 1 suite and 66 cases: 64 from the guard's `it.each` over the
64 scanned test sources (the count is visible in the red run above — `1 failed, 64 passed`), 1 for the
guard's own non-vacuity check, and 1 for the P1.5 scenario. 576 + 66 = 642. ✓

### `review` — BDD gate, AC verdicts, `bug.sync_state`

**`tests.bdd.run`.** The BDD-bearing suites for this task's contracts —
`P1.5-memory-search.feature` (all three scenarios), `P1.12-keyword-search.feature`, and the new guard:
`test/cli/program.integration.test.ts`, `test/core/query-latency.test.ts`,
`test/core/memory-search.test.ts`, `test/memory/query.test.ts`,
`test/core/latency-budget-placement.test.ts` — **5 suites / 152 tests, all passed**, 11.8 s.

**AC verdicts.**

| AC | Verdict | Evidence |
|----|---------|----------|
| 1 | **MET** | The budget is asserted in `test/core/query-latency.test.ts` around the registered `memory.memorySearch` `CoreFn` — the same call `wingfoil memory search` and the MCP `wingfoil://memory/search` Resource dispatch to — with no process boundary anywhere in the measurement. `program.integration.test.ts` now asserts exit code, output shape and content only. |
| 2 | **MET** | `P1.5-memory-search.feature` is unchanged. Its "Find a decision by keyword" scenario is satisfied across two assertions that together cover it strictly more tightly than before: the integration test proves the CLI returns the "API design" document at exit 0; the in-process benchmark proves the same scenario's query (Background document titled "API design" tagged "architecture", query `api`) returns that document and only that document, p95 < 1,000 ms over 25 runs at 1,000-document scale. |
| 3 | **MET** | Three consecutive `npm test` runs at `maxWorkers: 11` (jest's default here), all exit 0, 61 suites / 642 tests — table above. Plus two runs at `--maxWorkers=4`, bug-011's documented repro setting, also green. |
| 4 | **MET** | Nothing deleted, nothing `.skip()`ed, no threshold widened: `1000` is still `1000`, in both the feature file and `P95_BUDGET_MS`. The suite grew by 66 cases and 1 file (diff: 4 files, +331/−8). One assertion was *removed* — the spawn-wrapped one — and that is the fix itself, not an evasion of it: the only remaining question is whether the clause it claimed to enforce is still enforced, and it is, more strictly. The retained budget in the new location is justified by measurement, not by assumption: observed p95 63.3 ms against 1,000 ms. |
| 5 | **Coverage / `docs:api` MET; `eslint` NOT MET — pre-existing, not this task's** | Coverage 97.96/88.22/97.65/98.38, all ≥ 80. `npm run docs:api` exit 0. `npx eslint .` exits 1 on **exactly one** error, `test/storage/git-backed-storage.test.ts:90`, byte-identical to the baseline taken on this branch before the first edit — `bug-009`, owned by **task-066**, whose branch this one is not based on. This task added zero lint findings; AC-5's eslint half closes when task-066 merges. |

**`bug.sync_state`.** `bug-011-cli-latency-assertion-measures-spawn-contention` is this task's only
`bug:` and this task is its only fix task, so the aggregate rule collapses to 1:1: the bug moves
`in-progress → in-review` in the same commit as this task's `memory.submit`.

**Commit-body deviation (CLAUDE.md §5.1).** §5.1 specifies a subject-only commit for `memory.submit`;
this one carries a short body naming the `bug.sync_state` it performs, so the paired bug transition is
legible from `git log` without diffing the bug file.

**Stopped at `in-review`.** No `memory.approve`, no merge, no worktree or branch removal — approval
authority is the `approver` role's (CLAUDE.md §4/§8).
