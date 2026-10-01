---
id: "task-167-build-governance-check-over-pushed-wf-commits"
type: task
title: "Build the governance check over pushed wf() commits"
status: in-progress
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "process", "governance", "ci"]
ref: "dl-103"
bug: []
depends_on: ["task-126-declare-closed-wf-operation-grammar-bracket-set-state", "task-127-add-memory-amend-id-reason-approver-gated-verb"]
tmpl_version: 260703
---

## Description

Governance rules on `wf()` commits are checked by nobody. A read-only script checks a commit range: subject grammar with the ratified verb set, canonical bracket, `Approver:`/`Reason:` shape (dl-067), authority (author is a `team.members` approver, dl-094) and state legality (`verifyTransitionConsistency`). It hard-fails on commits after its introduction and reports older history without failing.

## Acceptance Criteria

- (red-first) one fixture repo per rule with a violating and a conforming commit; each violation is reported with sha and rule; exit 1 on a violation after the introduction commit, 0 with a report for history before it.
- (characterization) reuses `src/memory` parsers (commit-message, audit, state-machine) rather than re-implementing them; not shipped in the tarball (`npm pack --dry-run`, spec-015).
- (characterization) run over `main` at the task's base: the report's counts recorded (history is reported, not failed).

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-103 §1 (checks), starting mode.
- **Features:** P1.10, P4.14.
- **Planning ruling:** Approver ruling 2026-09-30 (plan R19): `dl-103` §2 (iii), signed approvals, is out of v0.3 (v0.4 at the earliest, possibly v1.0).
- **Notes:** Proposal key: D21.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.
- **Handover from wave 0 (2026-10-01, `task-126`'s independent review).** `verifyTransitionConsistency(root, path, machine?)` (`src/memory/audit.ts`) has no product caller yet; this check is its first. Pass the type's machine (loaded from `memory.yaml` at the checked commit) so `illegal-hop` findings fire, because without it only a chain's endpoints are compared. Known historical drift the "report older history without failing" mode will list: `6437dbc4`, `50e57a04`, `28e41379` (a multi-hop `sync` whose bracket starts at `in-review` while the frontmatter was `planned`), 7 single-hop mismatches and 11 unparseable multi-bracket `sync` subjects (e.g. `02b77f97`, `764eb2a6`). Since the approver's 2026-10-01 ruling, the verb set is eleven, with `assign` (no bracket, no `Approver:`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
