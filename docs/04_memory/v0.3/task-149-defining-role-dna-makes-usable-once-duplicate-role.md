---
id: "task-149-defining-role-dna-makes-usable-once-duplicate-role"
type: task
title: "Defining a role in DNA makes it usable at once, and a duplicate role is refused with P5.4.1's message"
status: in-progress
release: "v0.3"
kind: "feature"
priority: "medium"
tags: ["v0.3", "agent", "dna", "roles"]
ref: ""
bug: []
depends_on: []
tmpl_version: 260703
---

## Description

P5.4.1 is in `minor-v0.3` `features:` with no task yet. Sc. 1–2 are characterization: a role added with `dna add team.roles --value data-engineer` is accepted by `directive assign` and by `agent execute --role` (task-218). Sc. 3 expects `role already defined: reviewer`, but `dna add` answers a duplicate with the generic `'<path>' already exists: …` (`src/dna/mutate.ts:292`). No test pins P5.4.1 (`grep -rln "P5.4.1" test` → nothing).

## Acceptance Criteria

- (characterization) A new role is immediately valid for `directive assign <id> <role>` and for `assertRoleDefined` (P5.4.1 sc. 1–2).
- (red-first) A duplicate `team.roles` entry is refused, nothing is written, exit 1, with sc. 3's message. **Or**, if design finds that `spec-002` / `spec-008` declare the generic message for every collection, the task returns the conflict to the approver instead of choosing. The outcome goes into Execution Notes.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** P5.4.1 BDD sc. 1–3.
- **Features:** P5.4.1.
- **Notes:** Proposal key: B18.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
