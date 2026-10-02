---
id: "task-151-check-backticked-name-specs-adrs-requirements-resolves-head"
type: task
title: "Check that every backticked name in specs, ADRs and requirements resolves at HEAD"
status: in-progress
release: "v0.3"
kind: "feature"
priority: "medium"
tags: ["v0.3", "process", "docs", "testing", "parity"]
ref: "dl-116"
bug: []
depends_on: []
tmpl_version: 260703
---

## Description

About one bug in six is a document disagreeing with the code; only the CLI reference has a parity test. A generic Jest check resolves backticked identifiers shaped like `src/` symbols, config key paths, commands or element ids, with an allowlist for retired names quoted on purpose. Warn for one release, then fail.

## Acceptance Criteria

- (red-first) `test/docs/name-resolvability.test.ts` resolves each class at HEAD; a fixture document with a dangling name produces a finding; an allowlisted one does not.
- (characterization) warn mode for v0.3 (findings reported, suite green), with the switch to fail named for v0.4 in the test header; the first run's findings counted in Execution Notes.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-116 (Q1 (C) with (B) first, Q2 (a), Q3 (ii)).
- **Notes:** Proposal key: D38.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
