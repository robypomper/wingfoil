---
id: "task-139-extend-documentation-doc-versioning-testing-directives-ratified-clauses"
type: task
title: "Extend the documentation, doc-versioning and testing directives with the ratified clauses"
status: backlog
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "process", "directives", "governance"]
ref: "dl-120"
bug: []
depends_on: []
tmpl_version: 260703
---

## Description

Five documentation rules (citations, resolvable references, transient facts, premises, gate↔rule) and the two testing rules (a guard says exactly what it asserts; an environment-dependent fix ships an invariant check) live only in decision-logs. `doc-versioning` assumes a `version:` that no tech-spec, ADR, DL or task carries. Write them into the stand-in directives, marked WingFoil-specific so they survive the P3.8 stand-in reconciliation.

## Acceptance Criteria

- (characterization) `.wingfoil/directives/custom/documentation.md` carries D1–D5 exactly as `dl-120` Decision states them, each citing its element, inside a section marked WingFoil-specific (dl-120 Q1 (a)); `grep -c "dl-120" documentation.md` ≥ 1.
- (characterization) `doc-versioning.md` carries V1 = `dl-047` option 1: the bump applies where a document declares `version:`/`**Version:**`; an `approved`/`accepted` Memory element edited in place records a dated `**Revision (date) — reason, per <element>.**` note instead.
- (characterization) `testing.md` carries T1 and T2 (T2 in form (a): an invariant check the normal suite runs), marked WingFoil-specific, citing `dl-121`.
- (characterization) `claim-evidence.md` *How a claim is recorded* gains a one-line pointer to D1; `code-quality.md` and `testing.md` each point at the gate that enforces them (D5: `lint.clean`, `typecheck.clean` once task-173 lands — name task-173's task id, not a future tense).
- (characterization) `npx wingfoil directives list --role developer` (worktree build) lists the edited directives with no new warning; `npm test` green.
- (characterization) `dl-075` (E sweep): `documentation.md`'s citation clause (dl-120 D1) states the rule — cite a symbol, heading, key path or quotation, pin the commit for moving state; bare line offsets stay legal only in notes; existing citations are fixed on touch — and cites `dl-075`.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-120 (Q1 (a), Q2 (a)); dl-047 (option 1); dl-121 (Q1 (a), Q2 = dl-120 Q1 (a)); dl-075 (citation form, E sweep: absorbed into dl-120 clause 1).
- **Features:** P3.5.
- **Notes:** Proposal key: D01. `dl-034` stays `ready` (cited). dl-120 Action 4 (close bug-040/bug-045 as absorbed) is superseded by gate 2, which triaged both as v0.3 fixes: bug-040 is task-188's, bug-045 is task-184's. This task is the single owner of the directive text of `dl-047` (V1), `dl-120` and `dl-121` (T1/T2); task-183 and task-184 carry their checks and named instances.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
