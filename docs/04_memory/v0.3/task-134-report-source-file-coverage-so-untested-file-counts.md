---
id: "task-134-report-source-file-coverage-so-untested-file-counts"
type: task
title: "Report every source file in coverage, so an untested file counts at 0%"
status: backlog
release: "v0.3"
kind: "fix"
priority: "high"
tags: ["v0.3", "core", "tests", "coverage"]
ref: "dl-136"
bug: ["bug-141"]
depends_on: []
tmpl_version: 260703
---

## Description

`jest.config.js` `roots: ['<rootDir>/test']` limits coverage discovery to files the tests load, so a file no test requires is absent from the report rather than at 0% (`bug-141`; three barrels are kept out this way today). `dl-136` (test-results publication, domain D) depends on this fix.

## Acceptance Criteria

- (red-first) running a single suite with `--coverage` lists every file matched by `collectCoverageFrom`, unloaded ones at 0% (the bug's reproduction, inverted).
- (red-first) a `test/lint/` check compares `find src -name '*.ts'` (minus the declared barrels) with the coverage summary's keys after a full run and fails on any difference.
- (characterization) the global threshold still passes, or the task records the new figure and the files responsible (claim-evidence).

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** dev-loop `refactor` coverage gate (>80 %); dl-136 prerequisite.
- **Notes:** Proposal key: C18.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
