---
id: "task-143-make-directive-loader-robust-dangling-symlinks-project"
type: task
title: "Make the directive loader robust to dangling symlinks and to a project with no configuration"
status: pending
release: "v0.3"
kind: "fix"
priority: "medium"
tags: ["v0.3", "core", "directives", "first-use"]
ref: "spec-013"
bug: ["bug-125", "bug-154"]
depends_on: []
tmpl_version: 260703
---

## Description

`statSync` in `src/core/loaders.ts:35` follows links, so one dangling symlink under `.wingfoil/directives/` makes every directive read throw a raw ENOENT (`bug-125`); a missing directory returns `[]` (`loaders.ts:29`), so `directives list` answers an empty listing with exit 0 in a project with no configuration (`bug-154`). `agent execute` (B) loads role directives through this loader.

## Acceptance Criteria

- (red-first) a dangling symlink is skipped with a warning naming it; other directives load.
- (red-first) `directives list` and `directives list --role x` in a git root with no `.wingfoil/` exit 1 with the "not initialized" message (same as task-174's MCP pre-flight wording).

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** spec-013; spec-012.
- **Features:** P3.4, P5.4.2.
- **Notes:** Proposal key: C15.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
