---
id: "task-128-allocate-element-ids-highest-number-ref-across-folder"
type: task
title: "Allocate element ids from the highest number on every ref, across every folder the type's path can resolve to"
status: pending
release: "v0.3"
kind: "fix"
priority: "high"
tags: ["v0.3", "core", "memory", "ids", "determinism"]
ref: "dl-101"
bug: ["bug-087", "bug-162"]
depends_on: []
tmpl_version: 260703
---

## Description

`nextSequenceNumber` (`src/memory/add.ts:85`) returns the count of files in the working-tree folder + 1, so a gapped sequence reissues an id already taken (`bug-087`; it fired on this planning as `dl-130`), and a `task`'s per-release folder restarts the counter at 1 in every release (`bug-162`). Ratified `dl-101` (a): take the highest number + 1 across local and remote-tracking refs and the working tree, over every folder the type's path pattern resolves to (all `v0.*/` folders for `task`). Until this ships build-backlog adds tasks by hand.

## Acceptance Criteria

- (red-first) with `dl-001…dl-020, dl-022` committed (gap at 021), `memory add --type decision-log` creates `dl-023`, not `dl-022` (`bug-087`).
- (red-first) with `task-108` under `v0.2/` and nothing under `v0.3/`, `memory add --type task --set release=v0.3` creates `task-109-…` under `v0.3/` (`bug-162`).
- (red-first) a number taken only on another local branch or on a remote-tracking ref is skipped (new scenario in `P1.3-memory-add.feature`, as `dl-101` Action 3 asks).
- (red-first) the result is independent of ref enumeration order (sorted, `REQ-SYS-07`).
- (characterization) the command-baseline directive records the allocator's declared baseline (committed refs + working tree), with a `version:` bump.

## Implementation Notes

- **Size:** M · **wave:** 0 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** dl-101 §2 (a), Action 3; command-baseline (declared baseline, dl-080).
- **Features:** P1.3.
- **Notes:** Proposal key: C03. no network access at `add` time (`git fetch` stays the operator's step, `dl-101` §1.1); (b) remote reservation is not in scope. `dl-101` §1's hand rule goes into the `git-conventions` directive (the task implementing `dl-119`, domain D); the release-health metric (`dl-101` Action 4) goes to the task implementing `dl-089`.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
