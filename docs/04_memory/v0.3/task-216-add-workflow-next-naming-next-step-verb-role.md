---
id: "task-216-add-workflow-next-naming-next-step-verb-role"
type: task
title: "Add `workflow next`, naming the next step's verb, role, element, directives and bindings"
status: backlog
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "workflow", "cli", "performance"]
ref: "spec-017"
bug: []
depends_on: ["task-202-deduce-iterate-over-over-memory-types-collections-live", "task-203-read-instance-history-walk-step-linkage-created-elements", "task-204-reshape-workflow-list-add-workflow-show-both-answering"]
tmpl_version: 260703
---

## Description

`workflow next [<ref>] [--assigned-to <who>]` returns the frontier of the selected instance: the first step is the one `agent execute --next` consumes. Each step reports its key, trail, scope, role, holders and `agentRole`, the role's directives, actions with bindings (`memory.add` argv with `--workflow <instance> --step <key>`, `agent` argv `wingfoil agent execute --workflow <id> --step <key>`, `manual` expected commit subject), checks with `evaluated: false`, evidence kinds and `missing`/`finalizable`, fallback/re-entry, mode/allowedModes/distinctFrom, cadence with `lastRun: "not-recorded"`. Nothing executes.

## Acceptance Criteria

- (red-first) BDD P4.4 sc. 1: the output shows the step name, target element, role and role directives; sc. 2: `--assigned-to me` keeps only steps whose role the git identity's member holds (also a member name/email or role name); sc. 3: `no next step: workflow 'release-cycle' is complete`, exit 0; no open instance → `no open workflows`, exit 0.
- (red-first) A `manual` binding on `dev-loop.start` reports the expected subject `wf(task): start <id> [backlog → in-progress]` per spec-003's verb rule; `release-planning.commit-backlog`'s `release.set_state(in-development)` reports `approve`.
- (red-first) `NextResult` JSON matches the §8 interface (a schema test), and the console view always prints key, trail, role, scope, actions with bindings, directive ids and any "human needed" line (§8).
- (red-first) REQ-PERF-03: `workflow next` on this repository's history (fixture: a clone at a pinned commit with one open instance) completes under 1,000 ms p95 over 20 runs, measured in-process, not by wall-clock sampling of a spawned CLI (the `bug-012` lesson).
- (characterization) No directive content is inlined (spec-012 §7 is `agent execute`'s), and no phase-level directive field exists (`dl-066` option 1).

## Implementation Notes

- **Size:** M · **wave:** 3 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** spec-017 §6.1–§6.4, §7.3, §8 Step/NextResult, §10, §11; REQ-PERF-03; ruling R16 (agent argv); dl-066 option 1 (directives only through role).
- **Features:** P4.4, P4.14, X1.1.
- **Notes:** Proposal key: A09. B's `agent execute --next` and `agent list --waiting` consume `NextResult` / `StatusResult`; their tasks should depend on task-216/task-225.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
