---
id: "task-141-reposition-brief-governance-layer-make-determinism-index-composite"
type: task
title: "Reposition the brief as a governance layer and make the Determinism Index composite"
status: pending
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "process", "vision", "docs"]
ref: "dl-112"
bug: ["bug-160"]
depends_on: []
tmpl_version: 260703
---

## Description

The brief positions WingFoil only against flat rule files, and uses "determinism" for both the context WingFoil assembles and code it does not control. One change edits the vision set together, so the Solution paragraph changes once (dl-131 Action 2), and reconciles the vision index that both decisions require updated in the same commit.

## Acceptance Criteria

- (characterization) `01_product-brief.md`: Vision Statement *Unlike* replaced (Q1 (B)); Key Differentiators restructured into "Replaces" / "Works with" (Q2 (c)); determinism sentence per Q3 (i) and dl-131 Decisions 1–2 in the same commit; v1.0 line "Determinism Index reported (I, P, O)"; every competitor fact sourced and dated in References (approve `Reason:` of dl-112).
- (characterization) `02_product-vision.md` Vision Statement; `08_mvp-canvas.md` (North Star clause, problem statement, v1.0 line); `03_is-isnot.md` (IS NOT line, DOES line narrowed); `06_features.md` (Determinism Index row); `07_sequencer.md` (v1.0 DoD); `minor-v1.0.md` Success Criteria and summary — each with its `doc-versioning` bump.
- (characterization) a proposed `REQ-STATE-10` (process conformance P computed from git and the configuration, fit criterion on dl-131 Decision 3's checks) added to `03_state-context.md` with traceability to the P measures; the approver ratifies it at review.
- (characterization) bug-160: `00_index.md`'s map shows each file's header version, date and line count, and its line ranges point at the named sections — verified by a one-line script in Execution Notes; task-186 updates it again for its files.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-112 (Q1 (B), Q2 (c), Q3 (i), Q4 (x)); dl-131 (Q1 (b), Actions 2–7).
- **Notes:** Proposal key: D27. README follows through `align-user-docs` (dl-112 Action 4), not here. Deviation from the brief: 00_index.md staleness is fixed here rather than left to user-docs because bug-160 must be named by a task and dl-112/dl-132 require the index updated with the edits.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
