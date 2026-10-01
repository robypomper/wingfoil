---
id: "task-127-add-memory-amend-id-reason-approver-gated-verb"
type: task
title: "Add `memory amend <id> --reason`, an approver-gated verb that records a content correction without a state change"
status: in-progress
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "core", "memory", "cli", "governance"]
ref: "dl-108"
bug: []
depends_on: ["task-126-declare-closed-wf-operation-grammar-bracket-set-state"]
tmpl_version: 260703
---

## Description

No verb amends an approved or terminal element, so every correction is a hand-written commit that `memory history` reports as `operation: null` (`dl-108` Context; spec-015 was amended seven times by hand). Ratified: a `memory amend <id> --reason` verb that commits the element's working-tree content change, leaves `status` untouched, requires approval authority, and writes `wf(<type>): amend <id> [<s> → <s>]` with `Approver:` and `Reason:`. A3 (what may be amended) is a per-type declaration in `memory.yaml`. Scheduled first so every later amendment in v0.3 (the Revision notes on approved specs and ready decision-logs) uses the verb.

## Acceptance Criteria

- (red-first) on an `approved` tech-spec with an uncommitted body edit, `memory amend <id> --reason r` exits 0, writes exactly one commit touching only that file, subject `wf(tech-spec): amend <id> [approved → approved]`, body `Approver: <name> <email> (approver)` and `Reason: r`.
- (red-first) refusals: no content change → exit 1; a working-tree edit that changes `status` → exit 1 naming the field; caller without approval authority → the same refusal `approve` gives (REQ-SEC-03); a type whose `memory.yaml` entry does not declare itself amendable → exit 1; missing or blank `--reason` → exit 2 (`dl-067`).
- (red-first) `memory history <id>` lists the entry with `operation: "amend"` and its approver and reason (P1.10).
- (red-first) `wingfoil memory --help` and `docs/cli-reference.md` list `amend` (the `test/docs/cli-reference.test.ts` gate).
- (characterization) `spec-008`, `spec-010` (amend owns the body and non-status fields) and `spec-001` (the per-type amendability key) carry the verb, each with a dated Revision note; this repository's `.wingfoil/memory.yaml` declares which types are amendable (`adr`: no, per A3 — a change to the decision is a new element), with a `version:` bump.

## Implementation Notes

- **Size:** M · **wave:** 0 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-108 A1 (a), A2 (i), A3; spec-008 §1/§2; spec-010 § Field-write ownership; spec-001 (per-type amendability).
- **Features:** P1.7, P1.10, P1.2.
- **Notes:** Proposal key: C02. `src/core/index.ts` (new CoreOperation), `src/memory/`, `src/cli/`. Uses the shared identity/pre-flight order of task-132 if task-132 lands first; otherwise task-132 folds `amend` into its helper. Consider `bug-076`'s lesson: the verb commits exactly the one file, `--only`.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
