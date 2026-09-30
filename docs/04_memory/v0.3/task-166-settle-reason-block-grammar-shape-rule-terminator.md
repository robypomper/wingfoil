---
id: "task-166-settle-reason-block-grammar-shape-rule-terminator"
type: task
title: "Settle the `Reason:` block's grammar: shape-rule terminator, C0 refusal and the reserved `WingFoil-Version` key"
status: backlog
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "core", "memory", "grammar", "security"]
ref: "dl-070"
bug: []
depends_on: ["task-126-declare-closed-wf-operation-grammar-bracket-set-state", "task-127-add-memory-amend-id-reason-approver-gated-verb"]
tmpl_version: 260703
---

## Description

Three ratified changes to `src/memory/commit-message.ts` and `spec-008` §2's `--reason` row, done in one pass as Appendix B proposed: keep the shape rule for the trailer paragraph and write it into `spec-008` (dl-070 S3) with a remedy in the refusal (S4); refuse C0 control characters other than `\t`/`\n` at exit 2 naming the character (dl-078; 0 of 1471 `wf(` bodies contain one); extend `RESERVED_TRAILER_LINE_RE` (`commit-message.ts:47`) to `WingFoil-Version` (dl-111 Q1).

## Acceptance Criteria

- (red-first) `--reason` containing `\x07` or `\x1b` exits 2 on every verb that takes it, `deprecate` included, and names the character by code point; `\t` and `\n` are accepted.
- (red-first) a reason line beginning `WingFoil-Version:` is refused at exit 2 like `Approver:`.
- (red-first) the trailing-`Key: value`-paragraph refusal message states the remedy (add a closing sentence) (S4).
- (characterization) existing multi-line reasons and the normalization contract are unchanged.
- (characterization) `spec-008` §2 states the terminator rule and the reserved keys; `dl-067` carries a dated amendment for clause 4, made with `memory amend` (task-127).

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-070 (A)+S3+S4; dl-078 (A); dl-111 Q1 (A); dl-067 clause 4 revision; spec-008 §2.
- **Features:** P1.7, P1.9.
- **Notes:** Proposal key: C05.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
