---
id: "task-152-stop-clonetemprepo-leaking-temp-directories-give-cloned-fixtures"
type: task
title: "Stop `cloneTempRepo` leaking temp directories and give cloned fixtures `gc.auto=0`"
status: in-progress
release: "v0.3"
kind: "fix"
priority: "low"
tags: ["v0.3", "core", "tests"]
ref: "dl-121"
bug: ["bug-064", "bug-065", "bug-197"]
depends_on: []
tmpl_version: 260703
---

## Description

`cloneTempRepo` (`test/storage/helpers/git-fixture.ts:72-74`) makes two `mkdtemp` directories per call and never removes them, and configures nothing, so `gc.auto=0` (set only in `makeTempGitRepo`, `:31`) never reaches a clone while a test is titled "every fixture repo".

## Acceptance Criteria

- (red-first) after a suite using `cloneTempRepo`, no directory it created remains (count via a registered cleanup; optional `globalTeardown` sweep reports leftovers by count).
- (red-first) a cloned fixture reports `git config gc.auto` → `0`.
- (characterization) the overclaiming test title/TSDoc matches the assertion.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** dl-121 T1.
- **Notes:** Proposal key: C20.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
