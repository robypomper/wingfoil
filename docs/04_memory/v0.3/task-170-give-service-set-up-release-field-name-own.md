---
id: "task-170-give-service-set-up-release-field-name-own"
type: task
title: "Give a `service`'s set-up release a field name of its own"
status: backlog
release: "v0.3"
kind: "fix"
priority: "low"
tags: ["v0.3", "core", "memory", "traceability"]
ref: "dl-088"
bug: ["bug-166"]
depends_on: ["task-127-add-memory-amend-id-reason-approver-gated-verb"]
tmpl_version: 260703
---

## Description

A `service`'s `release` means "set up in", while `traceability` gives `release` one meaning (the release the element's implementation is assigned to) and `build-backlog` stamps it (`bug-166`).

## Acceptance Criteria

- (characterization) the `service` template names the field `set_up_in` (or the design's choice); `svc-*` elements are corrected through `memory amend` (task-127); `traceability.md` states services are not stamped; version bumps.
- (red-first) the `service` type's schema/test refuses a `release` field on a service, or the template test pins the new name.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** dl-088 (service type); traceability directive (`release` meaning).
- **Features:** P1.13.
- **Notes:** Proposal key: C45.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
