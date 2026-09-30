---
id: "task-146-make-suite-result-independent-concurrent-runs-machine-load"
type: task
title: "Make the suite's result independent of concurrent runs and machine load"
status: backlog
release: "v0.3"
kind: "fix"
priority: "medium"
tags: ["v0.3", "core", "tests", "reliability"]
ref: "dl-121"
bug: ["bug-095", "bug-167"]
depends_on: []
tmpl_version: 260703
---

## Description

Two `npx jest` runs in one worktree delete and rebuild each other's `dist/` (`test/global-setup.cjs:22`, unguarded `rmSync`; `bug-095`), a false red that matters once agents run in parallel worktrees. `test/cli/publish-secrets.test.ts:303` (`npm publish --dry-run`) fails under `npx jest --coverage` and passes alone (`bug-167`).

## Acceptance Criteria

- (red-first) a second concurrent global setup waits on, or refuses with a clear message against, a lock held by the first; it never deletes a `dist/` another run is using.
- (red-first) the publish dry-run case declares its resource needs (timeout and serial execution, or its own isolated npm cache) and passes in three consecutive `npx jest --coverage` runs, recorded.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** dl-121 T2.
- **Notes:** Proposal key: C21. `bug-066` (same file, v0.4) is not in scope.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
