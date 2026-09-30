---
id: "task-168-accept-declared-not-applicable-value-required-fields-explicit"
type: task
title: "Accept a declared not-applicable value for required fields, and an explicit empty list"
status: pending
release: "v0.3"
kind: "feature"
priority: "medium"
tags: ["v0.3", "core", "memory"]
ref: "dl-124"
bug: ["bug-147"]
depends_on: ["task-127-add-memory-amend-id-reason-approver-gated-verb"]
tmpl_version: 260703
---

## Description

`isEmptyValue` (`src/memory/submit.ts:18-22`) treats `[]` as missing, so an author who explicitly sets `features: []` is refused (`bug-147`), and a required field cannot say "does not apply" (`dl-124`). Ratified: `template.frontmatter.not_applicable_allowed: [...]`, value `"n/a — <reason>"`, accepted only for declared fields.

## Acceptance Criteria

- (red-first) a declared field holding `"n/a — patch release"` passes `submit`; bare `n/a` or an undeclared field holding it is refused, naming the field.
- (red-first) the empty-list rule chosen in design (accept `[]` as present, or require `n/a` for lists) is asserted and stated in `spec-010`.
- (characterization) this repository's `memory.yaml` declares not-applicable for `release`'s `pillar`/`requirements` if the approver confirms (Action 4; version bump).

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-124 Q1 (A) `n/a`, Q2 (a) `not_applicable_allowed`, Q3 (ii) quoted reason; spec-001; spec-010.
- **Features:** P1.6, P1.13.
- **Notes:** Proposal key: C28.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
