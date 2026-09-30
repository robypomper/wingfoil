---
id: "task-242-verify-journey-4-workflow-success-criteria-end-end"
type: task
title: "Verify Journey 4 and the workflow success criteria end to end on a fresh project and on this repository"
status: pending
release: "v0.3"
kind: "feature"
priority: "medium"
tags: ["v0.3", "workflow", "verification"]
ref: "spec-017"
bug: []
depends_on: ["task-199-align-wingfoil-workflows-custom-v0-3-schema-commands", "task-205-rewrite-dev-loop-yaml-v1-5-red", "task-211-add-workflow-create-workflow-remove-req-sec", "task-217-add-workflow-start-workflow-end-recording-instance-plan", "task-226-add-workflow-finalize-which-records-checkpoint-or-uncarried", "task-227-link-added-element-workflow-step-memory-add-workflow", "task-235-agent-execute-next-workflow-ref-step-key-take", "task-239-serve-wingfoil-workflows-next-wingfoil-workflows-status-production"]
tmpl_version: 260703
---

## Description

A verification task: on a fresh `init` project, Morgan's Journey 4 (directives, a workflow started, a deliverable submitted, a "human needed" line, approval routed and given, `agent execute --next` launched on the step); on this repository, the nine commands against the committed configuration, including closing the hand-started `service-ingest-rel-v0.3-listings-plan` instance the way spec-017 §12 prescribes.

## Acceptance Criteria

- (characterization) A scripted run (a `docs/examples/` self-checking script, so it can join `e2e-smoke`) passes on a fresh project: `start → next → memory add --workflow → submit → status` (human-needed line) `→ approve → next → finalize → end`.
- (characterization) On this repository at the release candidate: `workflow list --all` and `workflow show` on every workflow report zero errors; `workflow status` output is recorded in Execution Notes.
- (characterization) Journey 4 steps checked by hand with the adapter of R17, each step's command and result recorded (minor-v0.3 "manually tested end-to-end").

## Implementation Notes

- **Size:** S · **wave:** 3 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** minor-v0.3 Success Criteria (workflow commands functional; `workflow next` names verb/role/element; approval routing; CLI notifications; zero-error load); spec-017 §12.
- **Features:** P4.2, P4.3, P4.4, P4.5, P4.6, P4.7, P4.8, P4.9, P4.14, P4.15, X1.1.
- **Notes:** Proposal key: A22. may be folded into the v0.3 `e2e-smoke` phase if the approver prefers; listed here so the success criterion has an owner.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
