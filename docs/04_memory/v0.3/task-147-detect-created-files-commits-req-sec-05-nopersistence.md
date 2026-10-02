---
id: "task-147-detect-created-files-commits-req-sec-05-nopersistence"
type: task
title: "Detect created files and commits in the REQ-SEC-05 no-persistence check"
status: in-progress
release: "v0.3"
kind: "fix"
priority: "medium"
tags: ["v0.3", "core", "security", "tests", "mcp"]
ref: "dl-121"
bug: ["bug-036"]
depends_on: []
tmpl_version: 260703
---

## Description

`test/mcp/helpers/channel-enumeration.ts:63-79` snapshots only listed files, so a read handler that creates a file or commits stays green. v0.3 adds workflow Resources (R12) this guard must cover.

## Acceptance Criteria

- (red-first) the helper also compares `git status --porcelain --untracked-files=all` and `git rev-parse HEAD` before and after; a planted handler that writes a new file, and one that commits, each fail it.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** REQ-SEC-05; dl-121 (named instance).
- **Features:** P5.2.1.
- **Notes:** Proposal key: C42.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
