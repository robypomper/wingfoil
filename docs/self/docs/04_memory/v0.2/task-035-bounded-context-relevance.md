---
id: "task-035-bounded-context-relevance"
type: task
title: "Infrastructure: REQ-PERF-05 — bounded context via relevance"
status: in-review
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "performance"]
ref: "REQ-PERF-05"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Performance constraint **REQ-PERF-05** (bounded context assembled by relevance filtering).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-PERF-05** in `docs/02_requirements/03_sard/02_performance-nfr.md`.

## Implementation Notes

Relates to the context loader (`spec-012`). Consumed by role/task-scoped context (REQ-STATE-05) and deprecated-exclusion (REQ-STATE-06).

## Execution Notes

### start

`depends_on: []`, `bug: ""` — no `bug.sync_state`. Branch `task/task-035-bounded-context-relevance`,
worktree `/home/robypomper/Workspaces/.wf2-wt/task-035-bounded-context-relevance`. Status
`backlog → in-progress`.

### design

**AC classification (T1).** The Acceptance Criteria section reduces to one AC — the REQ-PERF-05 Fit
Criterion itself: "Given 1,000 Memory documents of which K are relevant to the task, the assembled
context contains exactly the K relevant (non-deprecated) documents and 0 others." Classified
**red-first**: no relevance-filter/context-assembly primitive exists in `src/` today.
`src/memory/query.ts`'s own doc comment is explicit that it borrows spec-012's keyword/frontmatter
*discipline* for `memory search` but is NOT "the Agent Context Loader spec-012 itself defines" — so
this is new behavior, not a characterization of something already shipped.

**`depends_on: []`** — no `agent.read_related` (dl-015 hard gate) to run; nothing to acknowledge.

**`agent.verify_specs`.** Scope already covered by an existing **approved** tech-spec:
`spec-012-context-loader-relevance-filtering` (`status: approved`, `scope: src/core`) — its §6
"Relevance filtering (`relevance-filter`)" is exactly REQ-PERF-05's tiered scoring/ordering/bounding
algorithm (T1 explicit links, T2 same release scope, T3 shared traceability keys, T4 keyword/tag
overlap; `score = 1000*T1 + 100*T2 + 10*T3 + overlapCount(T4)`; order `score DESC, type ASC, id ASC`;
bounded by `ContextLimits {maxDocs: 40, maxBytes: 262144}`; deprecated/draft excluded). No new
tech-spec needed — **pass through**, no approval gate (design's `approval: {by_role: approver}` only
fires when a new spec is scaffolded, per `dev-loop.yaml`).

**Scope decision (this task only implements §6, not the whole spec-012 pipeline).** spec-012 defines
FOUR cooperating units (`dna-loader`, `directive-loader`, `relevance-filter`, `context-builder`) plus
the canonical serialized envelope (§7). REQ-PERF-05's own Fit Criterion is scoped to Memory-document
selection only ("the assembled context contains exactly the K relevant documents and 0 others") — it
does not require DNA/directive sections or the `## N. Section` Markdown envelope. Those belong to
sibling tasks already in the v0.2 backlog: **task-037-role-task-scoped-context** (REQ-STATE-05 —
"the assembled context object exposes separate `dna`, `memory`, `directives` sections") is the
`context-builder`/envelope task; **task-038-deprecated-excluded-from-context** (REQ-STATE-06) extends
deprecated-exclusion to `memory search` defaults, not just the loader. This task builds `relevance-filter`
(§6) as a standalone, reusable primitive — the same "primitive now, surface wiring later" split
`src/memory/query.ts` (task-008) already established for `memory search`, so task-037 wraps this
without reimplementing scan/scoring logic.

**Placement.** spec-012 §1 pins `relevance-filter` to the **`core`** module ("folded into the `core`
module... The module relocates to `src/core/` because the current DNA has no `context` module").
New file: `src/core/relevance.ts` (module `core`). It wraps, not reimplements, `src/memory/query.ts`'s
existing `listMemoryDocumentPaths`/`loadMemoryDocumentSummary` scan primitives (task-008) — no second
directory walk or frontmatter parser.

**Design (function shape).**
```
filterRelevantMemoryDocuments(root, memoryYaml, element: {type, id, frontmatter}, limits?)
  -> { documents: RelevantMemoryDocument[], note?: string }
```
`element` is the caller's already-resolved frontmatter of the active task (or other Memory element) —
this primitive does not itself resolve the element document (that is `context-builder`'s
`resolve-element` stage, §3 stage 1, out of this task's scope), keeping it a pure `(state) -> selection`
function per REQ-SYS-07. Excludes the element's own document, and any candidate whose `status` is
`draft`/`deprecated` (spec-012 §6: "Documents in states draft/rejected/deprecated are excluded"; the
later `spec-001-memory-yaml-schema` removed the `rejected` status entirely — "no document records
`status: rejected` anymore" — so that entry is vestigial-but-harmless and this collapses to
`draft`/`deprecated` today; see the spec-gap note below).
A candidate with `score <= 0` (no tier hit at all) is excluded — this is the relevance *threshold* the
BDD's "no relevant documents" edge case needs. Returns `note: "no relevant Memory found for task"`
(P5.3.3 BDD Scenario 3, verbatim) only when the bounded result is empty.

**Checks (post).** `frontmatter.required`/`depends_on.acknowledged` — N/A (no new spec, no deps).
`tech-spec.approved` — satisfied (spec-012 `approved`).

### red

New failing test `test/core/relevance.test.ts` for `src/core/relevance.ts`'s
`filterRelevantMemoryDocuments` (the one red-first AC — the REQ-PERF-05 Fit Criterion at 1,000-document
scale — plus the three P5.3.3-relevance-filtering.feature BDD scenarios and tier scoring/ordering/
bounding). Confirmed red: `Cannot find module '../../src/core/relevance'` (module absent). Commit
`5304d31`.

### green

Implemented `src/core/relevance.ts` (module `core`) — spec-012 §6 `relevance-filter`:
`filterRelevantMemoryDocuments(root, memoryYaml, element, limits?)`. Wraps `src/memory/query.ts`'s
`listMemoryDocumentPaths`/`loadMemoryDocumentSummary` for the scan (no reimplementation). Tiered scoring
`1000*T1 + 100*T2 + 10*T3 + overlapCount(T4)` (T1 explicit links `adr/spec/dl/bug/depends_on`; T2 same
release scope; T3 shared `P*`/`REQ-*` traceability keys; T4 keyword/tag overlap), order `score DESC,
type ASC, id ASC`, bounded by `ContextLimits {maxDocs:40, maxBytes:262144}`, `score<=0` dropped
(relevance threshold), element's own doc + `draft`/`deprecated`/`rejected`-status docs excluded, empty
result → `note: "no relevant Memory found for task"`. Determinism (REQ-SYS-07): no wall-clock/random,
all iteration over sorted paths + total-order sort. 9/9 relevance tests green. Commit `fd86e29`.

### refactor

1. Named the spec-012 §6 tier weights as constants (`TIER_1_EXPLICIT_LINK` …) so the formula reads as
   tiers, not magic numbers — commit `48548b0`.
2. Coverage-closing tests for defensive edge cases (no-release element, id-less doc path-fallback,
   array-valued traceability keys) — 12/12 relevance tests green — commit `ab18ccb`.
3. Doc/comment corrections (commit `566b446`): dropped a CLAUDE.md citation (cite
   `spec-001-memory-yaml-schema` instead), corrected the module doc, and documented the two items below.

### review

**Final gate numbers (worktree, machine idle):** `npm test` **561/561 GREEN** (58→59 suites; +12 new
relevance tests over the ~549 baseline; the previously-flaky `test/cli/program.integration.test.ts`
"under 1 second" wall-clock test passes at low load, untouched). `npm run test:coverage` **≥80%** —
global 98% stmts / 87.52% branch / 97.7% funcs / 98.45% lines; `relevance.ts` 98.98 / 84.5 / 100 / 100.
`tsc -p tsconfig.build.json` exit **0**. `npm run docs:api` exit **0** (TSDoc on every exported
declaration in `relevance.ts`). Scope delivered: spec-012 §6 `relevance-filter` only — a standalone,
reusable primitive; NOT wired into `src/core/index.ts`'s `CORE_MODULES` (no CLI/MCP surface, matching
task-008's "primitive now, surface later" split). No `bug.sync_state` (`bug: ""`).

**Follow-up 1 (coordinator) — deprecated-exclusion duplication.** `EXCLUDED_STATUSES` is defined
locally here. Sibling branch task-038-deprecated-excluded-from-context (REQ-STATE-06, not yet on
`main`) ships a shared `isDeprecatedStatus` + `memory`'s `DEPRECATED_STATE`. They can't be imported
until task-038 merges; once it does, this local set MUST be reconciled onto the shared helper so
deprecated-exclusion has one definition.

**Follow-up 2 (spec-gap, for the approver) — spec-012 §6 vs spec-001 conflict.**
`spec-012-context-loader-relevance-filtering` §6 (approved) enumerates `draft`/`rejected`/`deprecated`
as excluded; the later `spec-001-memory-yaml-schema` (approved) removed the `rejected` status entirely.
The `'rejected'` entry is therefore vestigial-but-harmless (can never match). Kept deliberately (specs
win — a `[SPEC]`-cited value is not silently dropped); spec-012 §6 needs reconciliation against
spec-001 to drop `rejected`.
