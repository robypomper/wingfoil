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
