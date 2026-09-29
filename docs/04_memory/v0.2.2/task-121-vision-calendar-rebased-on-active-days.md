---
id: "task-121-vision-calendar-rebased-on-active-days"
type: task
title: "The vision's calendar is re-based on active days, with actuals next to the original plan and a forecast that states its cadence"
status: in-progress
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

### design (architect, 2026-09-29)

- **depends_on: none** (`depends_on: []` in this file's frontmatter), so there is no upstream
  Execution Notes to read (`dl-015`).
- **Governing decision:** `dl-096-schedule-rebaseline-on-active-days`, `status: ready`
  (`grep -m1 '^status:' docs/04_memory/design/dls/dl-096-schedule-rebaseline-on-active-days.md`),
  ratified as Q1 (a), Q2 (i). No tech-spec is cited or needed: the change is to the vision documents
  only, which are specs themselves (`CLAUDE.md` §10.1).
- **AC classification (T1).** Every AC is **documentation / characterization**: there is no code
  behaviour, so no red test exists and none is fabricated. The evidence for each AC is the command
  whose output backs every number written, recorded below and in the sequencer itself.
  - AC 1 — documentation: actuals table, active-day budgets, forecast with cadence in
    `07_sequencer.md`; original plan kept verbatim.
  - AC 2 — documentation: v0.2.2 budget from build-backlog (14 tasks) next to `dl-096`'s proxy;
    `patch-v0.2.2` Planning notes explain the difference (content edit, no status change).
  - AC 3 — documentation: brief and canvas point at the sequencer.
  - AC 4 — documentation: `version`/date bump. All three documents were committed before
    (`git log --format='%h %ad' --date=short -1 -- docs/01_vision/{01_product-brief,07_sequencer,08_mvp-canvas}.md`
    → `a4c8a53e 2026-09-21`, `0927f5df 2026-06-29`, `0927f5df 2026-06-29`), so each is bumped once.
  - AC 5 — characterization: no `memory.yaml` change (`git diff main -- .wingfoil/memory.yaml` empty
    at review).
- **Tests.** No test reads the three vision documents' calendar
  (`grep -rln "01_vision" test/` → only `test/cli/journey-0a.integration.test.ts`, which cites
  `05_journeys.md` in a comment). The review gate runs `npm test` as a regression check only.

### documentation (developer)

<!-- filled while editing -->

### review (reviewer)

<!-- filled at review -->
