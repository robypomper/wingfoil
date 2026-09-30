---
id: "task-150-declare-task-kind-stop-line-threshold"
type: task
title: "Declare a task `kind` and the stop-the-line threshold"
status: backlog
release: "v0.3"
kind: "feature"
priority: "medium"
tags: ["v0.3", "process", "memory-config", "governance"]
ref: "dl-133"
bug: []
depends_on: []
tmpl_version: 260703
---

## Description

v0.2's fix share was invisible: six of nine "planned fixes" were feature tasks that absorbed a bug. The task template gains `kind: feature | fix`; the 30 % threshold is stated once for task-221's `start` check and task-222's Q18/Q19. It carries no dependency: the v0.3 tasks are added with the `kind` their backlog entry assigns, and this task declares the field they already carry.

## Acceptance Criteria

- (characterization) `memory.yaml` `task` declares `kind` `[AUTHORING]` (enum `feature|fix`, required from v0.3 tasks on); template carries it; version bumped.
- (characterization) every v0.3 task file carries `kind` (stamped from its proposal; a hand frontmatter edit per §5.1 or the amend verb if shipped); v0.1/v0.2 tasks are not edited — the heuristic (name or `bug:`) is used only by task-233 to backfill.
- (red-first) `memory submit` of a v0.3 task without `kind` is refused (required field), pinned on a scratch repo.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-133 §1 Q1 (b), §3 (Q3 (a)).
- **Features:** P1.13.
- **Notes:** Proposal key: D12. Independent of task-230 after dedupe (only a `memory.yaml` version bump to sequence). See backlog question Q11 on stamping `kind` before this lands.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
