---
id: "task-133-bind-builtin-security-directive-role-stop-tests-pinning"
type: task
title: "Bind the built-in `security` directive to every role, and stop tests pinning live bindings by exact array"
status: pending
release: "v0.3"
kind: "fix"
priority: "high"
tags: ["v0.3", "core", "directives", "security"]
ref: "dl-059"
bug: ["bug-112"]
depends_on: []
tmpl_version: 260703
---

## Description

The scaffold's `global:` holds only `security-secrets` (`src/storage/templates.ts:337-340`), so no agent context loads the built-in `security` directive (`dl-059`). Two suites assert this repository's live `roles.yaml` bindings by exact array (`test/directives/schema.test.ts:141`, `test/core/loaders.test.ts:197`), so every binding change — this one first — fails them (`bug-112`).

## Acceptance Criteria

- (red-first) `wingfoil init` (Scrum and Kanban) writes `security` under `global:`; resolution for any role includes it once.
- (red-first) the two suites assert properties (required ids present, no dangling ids) rather than the exact live array; a characterization run with one binding added stays green.
- (characterization) this repository's `roles.yaml` binds `security` globally, `version:` bumped.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** dl-059 option 1 (scaffold + dogfood); REQ-SEC-08.
- **Features:** P3.8, P5.4.2.
- **Notes:** Proposal key: C17.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
