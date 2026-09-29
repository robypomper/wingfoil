---
id: "task-121-vision-calendar-rebased-on-active-days"
type: task
title: "The vision's calendar is re-based on active days, with actuals next to the original plan and a forecast that states its cadence"
status: backlog
release: "v0.2.2"
priority: "low"
tags: ["v0.2.2", "vision", "planning", "docs"]
ref: "dl-096-schedule-rebaseline-on-active-days"
bug: []
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []
tmpl_version: 260703
---

## Description

The vision's dates predate a 67-day pause and v0.2's 2.3× scope growth (`retrospective-rel-v0.2-plan`
§6.9). `dl-096`, ratified as Q1 (a) and Q2 (i), moves release budgets to active days, in the vision
documents only. The forecast is refreshed at every retrospective.

## Acceptance Criteria

1. `docs/01_vision/07_sequencer.md` gains:
   - the actuals table for v0.1 and v0.2, with the source commands of §6.9;
   - active-day budgets per release;
   - a calendar forecast that states its cadence assumption.

   The original plan is kept for comparison, and is not rewritten.
2. The v0.2.2 budget uses the figure this release's `build-backlog` measured (14 tasks ÷ 6.5 per
   active day ≈ 2.2 active days), next to `dl-096`'s proxy of ≈ 4. `patch-v0.2.2`'s Planning notes
   explain the difference.
3. `01_product-brief.md` and `08_mvp-canvas.md` point at the sequencer instead of carrying their own
   dates.
4. Each edited document gets a `version` and date bump (`doc-versioning`).
5. No `memory.yaml` field is added. That is Q1 (b), left to v0.3's `release-planning`.

## Implementation Notes

- The vision documents are authoritative specs (`CLAUDE.md` §10.1). The edit is the ratified
  `dl-096`, and the approver reviews the numbers at the review gate.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
