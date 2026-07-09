---
id: "task-038-deprecated-excluded-from-context"
type: task
title: "Infrastructure: REQ-STATE-06 — deprecated excluded from context"
status: in-review
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "state"]
ref: "REQ-STATE-06"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the State constraint **REQ-STATE-06** (deprecated elements excluded from assembled context).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-STATE-06** in `docs/02_requirements/03_sard/03_state-context.md`.

## Implementation Notes

Interacts with `memory deprecate` (P1.9) and the relevance filter (REQ-PERF-05).

## Execution Notes

### design (architect) — 2026-07-09

**AC classification (T1, `dl-014` + testing directive)** — the REQ-STATE-06 Fit Criterion ("A
`deprecated` document never appears in an assembled agent context nor in default `memory search`
results, while remaining present on disk and in git history") is compound; split into three testable
clauses:

| AC | Classification | Rationale |
|----|----------------|-----------|
| AC1 — a `deprecated` document is excluded from **default** `searchMemoryDocuments`/`wingfoil memory search` results (no filter, keyword, or tag query) | **red-first** | Today `src/memory/query.ts`'s `searchMemoryDocuments` does not look at `status` at all — a deprecated doc matching a keyword/tag currently IS returned. Real behavioural delta a failing test can capture. |
| AC2 — a deprecated document remains resolvable by an **explicit** lookup (`findMemoryDocumentById`, `findMemoryDocumentByTypeAndId`, `listMemoryDocumentsByType` collection browsing, an explicit `--status deprecated` narrow) and the file stays present on disk/in git history | **characterization** | Already true today — none of those primitives filter by `status`, and `memory deprecate` (P1.9 Scenario 1, already implemented) only flips the frontmatter field, it never deletes the file. Locked in with characterization tests, not new behavior. |
| AC3 — a deprecated document is excluded from an **assembled agent context** | **red-first primitive, no consuming surface yet** | spec-012's `context-builder`/`relevance-filter` (the module that would assemble "agent context") is not implemented in `src/core` — it is `planned`, and its own scope note in `src/memory/query.ts`'s module doc says as much ("applied here to `memory search` rather than the Agent Context Loader spec-012 itself defines"). `task-035-bounded-context-relevance` (REQ-PERF-05, still `backlog`) is where that module lands. This task ships the shared, reusable exclusion primitive (below) that `task-035`'s future `relevance-filter` MUST wrap (per this task's own Implementation Notes: "Interacts with … the relevance filter (REQ-PERF-05)") — it does not build `context-builder` itself, which is out of REQ-STATE-06's scope. Recorded as a scope boundary, not a spec gap (see spec verification below). |

**`depends_on` (`dl-015`):** `[]` — no upstream task Execution Notes to read; no `agent.read_related`
gate to clear. (Note: `task-035`'s own Implementation Notes name this task as a *future consumer* of its
relevance filter, but the registry's `depends_on` graph — dev-loop plan §4 — does not make `task-038`
depend on `task-035`; both are Wave 1. Consistent with that, this task provides the primitive standalone,
usable by `searchMemoryDocuments` today and by `task-035`'s relevance-filter later.)

**Spec verification (`agent.verify_specs`):** No new `tech-spec` needed. `spec-012-context-loader-relevance-filtering`
(`status: approved`) §6 already specifies "Documents in states `draft`/`rejected`/`deprecated` are
excluded" for the future relevance-filter; `docs/02_requirements/03_sard/03_state-context.md`'s
REQ-STATE-06 already cites the governing BDD (P1.9 `p1-memory/P1.9-memory-deprecate.feature` Scenario
"Deprecated documents are excluded from default agent context", P5.3.3
`p5-interaction/P5.3.3-relevance-filtering.feature` Scenario "Deprecated documents are never loaded") —
both already exist. `design` passes through with **no approver gate** (no new spec scaffolded).

**Implementation approach (wrap, don't reimplement):** add an `includeDeprecated` opt-in to
`MemorySearchOptions` (default `false` → excluded, matching "default … results" in the Fit Criterion)
and a standalone `isDeprecatedStatus(frontmatter)` primitive in `src/memory/query.ts`, reusing the
already-exported `DEPRECATED_STATE` constant from `src/memory/state-machine.ts` (single source of
truth, no duplicated magic string). Wire `searchMemoryDocuments` to skip deprecated documents by
default. `src/core/index.ts`'s `memorySearchFn` passes `includeDeprecated: true` only when the caller's
own `--status deprecated` narrow is explicit (an intentional override, not a "default" search per the
Fit Criterion's wording) — preserving the ability to look a deprecated document up on purpose. Leaves
`findMemoryDocumentById`/`findMemoryDocumentByTypeAndId`/`listMemoryDocumentsByType` untouched (AC2:
explicit lookup/browsing, not "default search" or "assembled context").

### red — 2026-07-09

Added a `REQ-STATE-06` describe block to `test/memory/query.test.ts` (deprecated excluded from a
default keyword search and a default tag browse; `includeDeprecated: true` opt-in still finds it;
non-deprecated docs unaffected; AC2 characterization — id lookup + `listMemoryDocumentsByType`
browsing + on-disk presence all still see the deprecated doc; `isDeprecatedStatus` unit cases) and a
`REQ-STATE-06` describe block to `test/core/memory-search.test.ts` (real `memory.memorySearch` core-op:
default keyword/tag search excludes deprecated; explicit `--status deprecated` still resolves it).
Ran red: **7 failing / 48 passing** across the two files — deprecated docs were being returned
(`isDeprecatedStatus` not yet a function; deprecated ids present in results). Commit `a95ccaa`.

### green — 2026-07-09

Wrapped the existing primitives, no reimplementation:
- `src/memory/query.ts`: new exported `isDeprecatedStatus(frontmatter)` (reuses `DEPRECATED_STATE`
  from `state-machine.ts` — single source of truth), new `includeDeprecated?: boolean` on
  `MemorySearchOptions` (default `false`), and one guard line in `searchMemoryDocuments`
  (`if (!options.includeDeprecated && isDeprecatedStatus(frontmatter)) continue;`).
- `src/memory/index.ts`: re-export `isDeprecatedStatus` through the barrel (parity with the sibling
  query primitives).
- `src/core/index.ts`: `memorySearchFn` passes `includeDeprecated: true` to the scan **only** when the
  caller's `--status deprecated` narrow is explicit; append-only spread, kept minimal (sibling tasks
  also touch this file). Ran green: **55/55** across the two files. Commit `bbb122d`.

### refactor — 2026-07-09

No structural change needed — the green code was already at refactor quality. One documentation tidy:
extended `src/memory/query.ts`'s module-level doc comment to record the new REQ-STATE-06
deprecated-exclusion responsibility and point the future spec-012 relevance-filter (task-035) at the
same `isDeprecatedStatus` primitive. Tests still 55/55, `tsc` 0, `docs:api` 0. Commit `2b22556`.

### review — 2026-07-09

**Traceability:** REQ-STATE-06 (SARD `03_state-context.md`) → BDD `p1-memory/P1.9-memory-deprecate.feature`
Scenario "Deprecated documents are excluded from default agent context" + `p5-interaction/P5.3.3-relevance-filtering.feature`
Scenario "Deprecated documents are never loaded" → this task. Both scenarios are encoded as the Jest
tests added above (the v0.2 repo has no separate cucumber runner; BDD acceptance = Jest tests citing
the scenarios). `spec-012 §6` (approved) already specified the same exclusion for the future
relevance-filter — no new tech-spec scaffolded, `design` passed through with no approver gate.

**Scope boundary (recorded, not a spec gap):** REQ-STATE-06's "assembled agent context" clause depends
on spec-012's `context-builder`/`relevance-filter`, which is not yet implemented in `src/core`
(`task-035-bounded-context-relevance`, still `backlog`, owns it). This task ships the reusable
`isDeprecatedStatus` exclusion primitive + the `searchMemoryDocuments` default-exclusion that task-035's
relevance-filter must wrap; it does not build `context-builder` itself. The "default `memory search`
results" half of the Fit Criterion is fully satisfied and tested here.

**Gates:**
- `npm test` (full suite): **561/562 passing.** The one failure is `test/cli/program.integration.test.ts`'s
  wall-clock assertion ("memory search api … under 1 second", observed 4869 ms) — a **pre-existing flake
  under parallel load** (10 concurrent dev-loops saturating the machine), flagged by the coordinator,
  NOT a regression from this task and out of scope to touch. Re-run in isolation: **28/28 passing.**
- `tsc -p tsconfig.build.json`: exit **0**.
- `npm run test:coverage`: overall **97.92% stmts / 88.03% branch / 97.58% funcs / 98.34% lines**
  (`query.ts` 100% stmts) — ≥ 80%.
- `npm run docs:api`: exit **0** (TSDoc present on the two new exports `isDeprecatedStatus` and the
  `includeDeprecated` option; ACTIVE hard-reject gate satisfied).
- Determinism: the added guard is a pure frontmatter-status check inside the already-deterministic,
  lexicographically-sorted scan — no wall-clock, randomness, or unordered iteration introduced.
