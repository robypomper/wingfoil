---
id: "task-037-role-task-scoped-context"
type: task
title: "Infrastructure: REQ-STATE-05 — role/task-scoped context"
status: in-progress
release: "v0.2"
priority: "Blocker"
tags: ["v0.2", "state"]
ref: "REQ-STATE-05"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the State constraint **REQ-STATE-05** (context scoped to the active role and task).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-STATE-05** in `docs/02_requirements/03_sard/03_state-context.md`.

## Implementation Notes

Feeds directive auto-load (P3.6) and MCP Prompts (P5.2.2).

## Execution Notes

### design

- **T1 AC classification.** Single AC ("satisfies REQ-STATE-05's Fit Criterion") — **red-first**: no
  context-assembly code exists anywhere in `src/` today (confirmed via `grep -rl "context-builder\|
  ContextRequest\|assembleExecutionContext" src test` — zero hits before this task). Not a
  characterization AC.
- **`depends_on`: `[]`** — no `agent.read_related` gate to satisfy.
- **`verify_specs`.** `spec-012-context-loader-relevance-filtering` (`status: approved`) already covers
  this surface end-to-end (dna-loader / directive-loader / relevance-filter / context-builder, the full
  `ContextRequest` → canonical Markdown envelope pipeline). No new tech-spec needed — **pass-through**,
  no approval gate.
- **Scope decision (recorded, not a spec gap).** spec-012's full pipeline (byte-for-byte canonical
  Markdown serialization §7, `ContextRequest`/`stateRef` pinning, T1–T4 tiered relevance ranking +
  bounding §6, `agent execute` wiring) is NOT this task's scope — those land as their own backlog items:
  `docs/03_backlog/04_backlog/by-release/v0.3.json` carries REQ-SYS-07 (deterministic context assembly),
  REQ-PERF-01 (context load time), REQ-STATE-09 (context determinism), P5.4.3/P5.4.4 (the actual
  `agent execute` / execution-context CLI features) as separate v0.3 tasks. This task's own `ref` is
  narrowly **REQ-STATE-05** only ("assembled context object exposes separate `dna`, `memory`,
  `directives` sections; 100% of the role's directives, 0% of other roles'") — confirmed against the
  sibling Wave-1 v0.2 tasks that split the rest of spec-012: task-038 owns REQ-STATE-06 (deprecated
  exclusion), task-035 owns REQ-PERF-05 (relevance-filter bounding/performance). Implemented here: the
  `directive-loader` (role→directives resolution via a new, minimal `roles.yaml` schema/loader, mirroring
  `loadDirectives`) + a `context-builder`-shaped `assembleExecutionContext` that returns a plain
  `{ dna, directives, memory }` object with `memory` scoped to the single named task element (via the
  existing `findMemoryDocumentByTypeAndId` primitive, task-011) — no tiered ranking, no canonical
  Markdown serialization, no bounding caps (those are task-035/038/v0.3's scope). Module: `core`
  (spec-012 §1: "Context Loader lives in the `core` module").
- Directives auto-loaded: architecture, determinism, traceability. No approval needed — pass-through.
