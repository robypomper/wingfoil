---
id: "task-035-bounded-context-relevance"
type: task
title: "Infrastructure: REQ-PERF-05 — bounded context via relevance"
status: in-progress
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
`draft`/`deprecated` (spec-012 §6: "Documents in states draft/rejected/deprecated are excluded"; per
CLAUDE.md §5 there is no longer a distinct `rejected` status anywhere in `memory.yaml`, so this
collapses to `draft`/`deprecated` today — `rejected` kept in the excluded set defensively/harmlessly).
A candidate with `score <= 0` (no tier hit at all) is excluded — this is the relevance *threshold* the
BDD's "no relevant documents" edge case needs. Returns `note: "no relevant Memory found for task"`
(P5.3.3 BDD Scenario 3, verbatim) only when the bounded result is empty.

**Checks (post).** `frontmatter.required`/`depends_on.acknowledged` — N/A (no new spec, no deps).
`tech-spec.approved` — satisfied (spec-012 `approved`).
