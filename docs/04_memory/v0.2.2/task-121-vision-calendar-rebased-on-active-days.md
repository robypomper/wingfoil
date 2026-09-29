---
id: "task-121-vision-calendar-rebased-on-active-days"
type: task
title: "The vision's calendar is re-based on active days, with actuals next to the original plan and a forecast that states its cadence"
status: in-review
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
    (`for f in 01_product-brief 07_sequencer 08_mvp-canvas; do git log --format='%h %ad' --date=short -1 -- docs/01_vision/$f.md; done`
    → `a4c8a53e 2026-09-21`, `0927f5df 2026-06-29`, `0927f5df 2026-06-29`), so each is bumped once.
  - AC 5 — characterization: no `memory.yaml` change (`git diff main -- .wingfoil/memory.yaml` empty
    at review).
- **Tests.** No test reads the three vision documents' calendar
  (`grep -rln "01_vision" test/` → only `test/cli/journey-0a.integration.test.ts`, which cites
  `05_journeys.md` in a comment). The review gate runs `npm test` as a regression check only.

### documentation (developer)

- **Measurements re-run** (not copied from `retrospective-rel-v0.2-plan` §6.9), all at `a20b346c`:
  - `git log a20b346c --format=%cd --date=short | sort -u | wc -l` → `26`; the dates split 9
    (06-14 … 07-03), 5 (07-04 … 07-08), 1 (07-09), 11 (09-14 … 09-28).
  - Gaps > 2 days over that list (a short Python diff) → `06-14→06-21 7`, `06-26→06-29 3`,
    `06-29→07-02 3`, `07-09→09-14 67`, `09-18→09-21 3`, `09-25→09-28 3`.
  - `git log a20b346c --format='%h %cd %s' --date=iso --grep=minor-v0.1 --grep=minor-v0.2 | grep released`
    → `d2ad1f3f 2026-09-28 11:24:24 … mark-released minor-v0.2`, `5b16ab61 2026-07-08 11:42:33 …
    approve minor-v0.1 [releasing → released]`.
  - `git ls-tree --name-only a20b346c docs/self/docs/04_memory/v0.1/ | wc -l` → `33`; `…/v0.2/` → `75`;
    `…/v0.2/` filtered to task ids 34–65 → `32`.
  - Bugs, §6.9's command with `<range>` `20e8271..a20b346c` → `129`, `20e8271` → `7` (reproduced; not
    restated in the sequencer).
  - `features:` lists of `docs/04_memory/planning/rl-v1/minor-v0.{1,2,3,4}.md`, `minor-v1.0.md` →
    13, 14, 26, 8, 3.
  - `git ls-tree --name-only 4770a52c docs/self/docs/04_memory/v0.2.2/ | wc -l` → `14` (build-backlog);
    `ls docs/04_memory/v0.2.2/ | wc -l` → `15` at `c3df9df3`; `task-123` added at `50c64846`.
  - `git log a20b346c..main --format=%cd --date=short | sort -u` → `2026-09-28 2026-09-29` (v0.2.2's
    active dates so far; not written into the docs, noted for the retrospective).
- **Deviation.** My first draft called 6.5 "the rounded mean" of 6.6 and 6.3; it is not
  (`(6.6 + 6.25) / 2 = 6.425`). Corrected before review (`1fd2a47d`, `7257d7a4`): 6.5 is the figure
  build-backlog used; the pooled rate is 108 ÷ 17 ≈ 6.35, which leaves 14 tasks at 2.2 days and moves
  15 tasks from 2.3 to 2.4.
- **What changed.** `07_sequencer.md` v1.3 → v1.4: a *Re-baseline on active days* section ahead of the
  original plan (actuals, budgets, forecast at ≈ 5 active days a week from October 2026 → late November
  2026), and a note that marks the original plan as kept for comparison; `git diff main -- docs/01_vision/07_sequencer.md | grep '^-'`
  shows only the two header lines. `01_product-brief.md` v1.3 → v1.4 and `08_mvp-canvas.md` v1.1 → v1.2:
  dates replaced by pointers to the sequencer. `patch-v0.2.2` Planning notes: why the figures differ,
  recalculation for 15 tasks; no status change.

### review (reviewer)

- `npm test` → `Test Suites: 152 passed, 152 total`, `Tests: 2472 passed, 2472 total` (regression
  check only; no test reads these documents).
- AC 5: `git diff main --stat -- .wingfoil/memory.yaml` → empty.
- AC 3: `grep -n -i -E "july|august|aug |2026-0[78]" docs/01_vision/01_product-brief.md docs/01_vision/08_mvp-canvas.md`
  → nothing.
- **For the approver** (out of scope, not fixed here): the canvas's documentation-reference table was
  already stale for rows this task does not touch — `06_features.md` listed 1.2 (file is 1.4) and
  `X_cli-cmds.md` 1.1 (file is 1.3) (`grep -H -m1 '^\*\*Version' docs/01_vision/*.md`). The three
  documents keep `Status: Approved`; whether a vision edit needs its own approval record is `dl-125`.

**Approver's ruling at the review gate (2026-09-29).**
- The planning velocity stays **6.5** tasks per active day. The sequencer and `patch-v0.2.2`'s
  Planning notes now say it is the ratified rate. 6.35 remains in both only as the pooled
  measurement.
- The canvas reference table is corrected: `06_features.md` 1.2 → 1.4 and `X_cli-cmds.md` 1.1 → 1.3,
  the versions in each file's header (`grep -m1 '^\*\*Version' docs/01_vision/<file>`). The canvas
  stays at 1.2, the version this task gave it.
- Not touched, recorded for later: `docs/01_vision/00_index.md`'s document map is stale too (brief
  1.2, sequencer 1.3, canvas 1.1, features 1.2, cli-cmds 1.1, "Last indexed: 2026-06-25"), and so are
  its line ranges.
