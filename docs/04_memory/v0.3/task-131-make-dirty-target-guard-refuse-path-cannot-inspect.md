---
id: "task-131-make-dirty-target-guard-refuse-path-cannot-inspect"
type: task
title: "Make the dirty-target guard refuse a path it cannot inspect, and stop exporting the unconfined resolver"
status: backlog
release: "v0.3"
kind: "fix"
priority: "high"
tags: ["v0.3", "core", "security", "storage"]
ref: "dl-086"
bug: ["bug-118", "bug-122", "bug-124", "bug-182"]
depends_on: []
tmpl_version: 260703
---

## Description

`requireUnmodifiedTarget` treats empty `git status --porcelain` as clean (`src/core/write-guard.ts:124`), which is also what git prints for a path beyond a symlink, so the guard fails open on every write path (`bug-118`); a `directives/custom` symlinked elsewhere inside the root unlinks the file and then fails at commit (`bug-124`). `resolveMemoryPath`, the unconfined sibling, is exported from the storage barrel with no caller (`bug-122`). v0.3 adds writers (run records, workflow plans) that will call this guard.

## Acceptance Criteria

- (red-first) a target beyond a symlink (in-root and out-of-root) is refused before any write, exit 1, naming the path; the six `requireUnmodifiedTarget` call sites are covered.
- (red-first) `directive remove` on an in-root symlinked `custom/` refuses before unlinking; the file still exists afterwards (`bug-124`).
- (red-first) `resolveMemoryPath` is not exported from `src/storage/index.ts` (a test on the barrel's export list).
- (characterization) an ordinary clean target still passes.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** REQ-SEC-06; dl-086 (filesystem-effect reads); dl-080.
- **Features:** P1.1, P3.3.
- **Notes:** Proposal key: C11.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
