---
id: "task-140-run-packaging-gate-push-pull-request-separate"
type: task
title: "Run the packaging gate on every push and pull request in a separate ci.yml"
status: pending
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "process", "ci"]
ref: "dl-076"
bug: []
depends_on: []
tmpl_version: 260703
---

## Description

The pipeline environment is entered once per release; v0.2's two npm/git blockers surfaced only at the tag. A second workflow runs `npm ci` + `prepublishOnly` on push and PR at the same `NODE_VERSION`, leaving `publish.yml`'s trigger untouched.

## Acceptance Criteria

- (characterization) `.github/workflows/ci.yml`: `on: push` (all branches) and `pull_request` to `main`; `ubuntu-24.04`; Node from the same pinned value as `publish.yml` (one source, or a test asserting equality); actions pinned by SHA; `permissions: contents: read`.
- (red-first) a test in `test/cli/` (as `publish-pipeline.test.ts` does for `publish.yml`) asserts the trigger, runner, Node equality, the two steps and the permission set.
- (characterization) first run green on the task branch (run URL in Execution Notes).

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-076 (D) (Q1 two tasks, Q2 a CI failure on the branch, Q4 no adr-009 amendment).
- **Notes:** Proposal key: D19. (A) corepack/packageManager, Q3 and `bug-119` stay v0.4.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
