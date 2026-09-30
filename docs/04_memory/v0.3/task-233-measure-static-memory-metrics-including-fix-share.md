---
id: "task-233-measure-static-memory-metrics-including-fix-share"
type: task
title: "Measure the static and Memory metrics, including the fix share"
status: pending
release: "v0.3"
kind: "feature"
priority: "medium"
tags: ["v0.3", "process", "release-health", "scripts"]
ref: "dl-089"
bug: []
depends_on: ["task-150-declare-task-kind-stop-line-threshold", "task-222-declare-release-health-catalogue-v2-report-schema-release"]
tmpl_version: 260703
---

## Description

Complexity, duplication, import cycles and bypasses, unused dependencies and install size, dangling process-id references, SARD-cited-by-tests, bug and DL flow, document-divergence share, Memory volume, and Q18/Q19 from the `kind` field (heuristic before v0.3).

## Acceptance Criteria

- (red-first) each metric on a fixture with known answers; no new dependency (`dl-010`): where a metric needs a tool the repo lacks (e.g. clone detection), a minimal in-repo implementation or `not-measurable` with the reason, decided at design.
- (red-first) Q18/Q19 read `kind` for v0.3+ and the name-or-`bug:` heuristic for v0.1/v0.2; a feature task that absorbed a bug counts as feature (dl-133 §1).
- (characterization) Q15 classifies with dl-116's definition written in the catalogue.
- (characterization) `dl-010` Action 3 (E sweep): the production dependency count (`npm ls --omit=dev --depth=0`) is reported in the static metrics, so every retrospective sees it.

## Implementation Notes

- **Size:** M · **wave:** 3 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-089 §2 (Q05–Q10, Q13–Q16); dl-133 §1 (Q18, Q19 + v0.1/v0.2 heuristic backfill); dl-116 Action 2; dl-010 Action 3 (dependency count audit, E sweep).
- **Features:** P4.1.
- **Notes:** Proposal key: D17.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
