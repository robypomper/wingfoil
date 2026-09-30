---
id: "task-155-assert-lockfile-root-engines-equals-package-json-floor"
type: task
title: "Assert that the lockfile's root `engines` equals `package.json`'s and that the floor equals the closure maximum"
status: backlog
release: "v0.3"
kind: "fix"
priority: "low"
tags: ["v0.3", "core", "tests", "publishing"]
ref: "spec-015"
bug: ["bug-046", "bug-047"]
depends_on: []
tmpl_version: 260703
---

## Description

Nothing asserts `package-lock.json`'s root `engines` equals `package.json`'s (`bug-046`); `spec-015` §1 says the floor "must equal" the dependency closure's maximum "enforced by an assertion", but `test/cli/publish-metadata.test.ts:602-609` asserts only that the floor satisfies each dependency (`bug-047`).

## Acceptance Criteria

- (red-first) a lockfile root `engines` edited to differ fails the suite.
- (red-first) an over-tight floor (above the closure maximum) fails the equality assertion.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** spec-015 §1 (engines rule); dl-121 (named instances).
- **Notes:** Proposal key: C43.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
