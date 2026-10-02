---
id: "task-145-replace-cli-test-helpers-fabricated-stderr-child-real"
type: task
title: "Replace the CLI test helpers' fabricated `stderr: ''` with the child's real stderr"
status: in-progress
release: "v0.3"
kind: "fix"
priority: "medium"
tags: ["v0.3", "core", "tests"]
ref: "dl-121"
bug: ["bug-070"]
depends_on: []
tmpl_version: 260703
---

## Description

Seven helpers under `test/cli/` return a literal `stderr: ''` on success (`fresh-init-transitions:65`, `journey-0a:56`, `missing-verb-exit-code:75`, `npm-distribution:74`, `program.integration:91`, `help-positional-required:41`, `commander-parse-exit-codes:55`), so every "printed nothing to stderr" assertion is vacuous. The workflow/agent CLI suites A and B write would copy it; one shared `spawnSync` helper ends it.

## Acceptance Criteria

- (red-first) a shared helper returns the real stderr on every path; a meta-test shows a helper call to a command that writes to stderr and exits 0 reports that text.
- (red-first) a `test/lint/` check fails if a `test/` file returns a literal `stderr: ''`.
- (characterization) the seven suites use the helper and stay green, or each newly visible stderr line is recorded and, if a defect, filed.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** dl-121 T1.
- **Notes:** Proposal key: C19.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
