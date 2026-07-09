---
id: "task-038-deprecated-excluded-from-context"
type: task
title: "Infrastructure: REQ-STATE-06 — deprecated excluded from context"
status: in-progress
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
