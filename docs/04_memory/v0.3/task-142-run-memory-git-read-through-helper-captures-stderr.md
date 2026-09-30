---
id: "task-142-run-memory-git-read-through-helper-captures-stderr"
type: task
title: "Run every Memory git read through one helper that captures stderr, sets `maxBuffer` and fails loudly"
status: pending
release: "v0.3"
kind: "fix"
priority: "medium"
tags: ["v0.3", "core", "memory", "git"]
ref: "spec-006"
bug: ["bug-072", "bug-093", "bug-097"]
depends_on: []
tmpl_version: 260703
---

## Description

`walkGitLogFields` (`src/memory/git-log.ts:84-90`) sets no `maxBuffer` and turns any error, ENOBUFS included, into an empty history (`bug-072`); it and `findElementCreationSha` (`history.ts:107`) inherit the operator's stderr (`bug-093`); `core.quotePath=false` and the probe's `stdio` are load-bearing and unpinned, and `audit.ts`'s `readStatusAt` TSDoc overclaims (`bug-097`). Workflow state deduction (A) reads history more, so a silent empty history becomes a wrong answer.

## Acceptance Criteria

- (red-first) a `git log` output above 1 MiB returns the full history (fixture with a long history or a lowered buffer seam), and a genuine git failure is an `IO` error, not `[]`.
- (red-first) the out-of-process harness in `test/memory/history-rename-path.test.ts` shows no git diagnostics on the operator's stderr for both call sites.
- (red-first) a non-ASCII element path round-trips through history (`core.quotePath=false` pinned).
- (characterization) the `readStatusAt` TSDoc says what the code does (T1).

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** spec-006 (error model); REQ-INT-08.
- **Features:** P1.10, P1.5.
- **Notes:** Proposal key: C07.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
