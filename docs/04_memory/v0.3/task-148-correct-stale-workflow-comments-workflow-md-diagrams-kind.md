---
id: "task-148-correct-stale-workflow-comments-workflow-md-diagrams-kind"
type: task
title: "Correct the stale workflow comments, the `WORKFLOW.md` diagrams and the `kind` requirement on the immutable minors"
status: pending
release: "v0.3"
kind: "fix"
priority: "medium"
tags: ["v0.3", "workflow", "docs", "configuration"]
ref: "dl-092"
bug: ["bug-169", "bug-170", "bug-175"]
depends_on: []
tmpl_version: 260703
---

## Description

Three configuration-document defects that mislead an agent reading the workflows: `initial-design.yaml` / `wingfoil-init.yaml` say the CLI/MCP are "not yet usable" (`bug-169`); `.wingfoil/WORKFLOW.md` draws `release-cycle` without `user-docs`/`e2e-smoke` and `release-planning` without three of its eight phases (`bug-170`); `release-planning.yaml`'s define-scope check and `memory.yaml`'s release `required:` demand `kind` that the immutable pre-`dl-092` minors cannot carry (`bug-175`).

## Acceptance Criteria

- (characterization) `grep -rn -i 'not yet usable' .wingfoil/` → no match; the two headers describe the shipped CLI/MCP, the absence of an engine in v0.3's terms (the workflow commands name steps; P4.10 executes them in v1.0) and the phase plans (`dl-019`).
- (red-first) `bug-170`: a test asserts that every phase name of every workflow `workflows.yaml` includes appears in `.wingfoil/WORKFLOW.md` (dl-116 (A) shape; the bug's step-3 loop as a test), failing before the redraw; `WORKFLOW.md` then draws `release-cycle`'s seven phases, `release-planning`'s eight, `e2e-smoke` with `mcp-registration`, and `user-docs` with its two align phases. `user-docs.yaml`'s `align-agent-docs` `produces:` gains `.wingfoil/WORKFLOW.md` (the bug's proposed guard), with a version bump.
- (red-first) `bug-175`: one rule — the chosen fix (exempt pre-`dl-092` ids in the check, or `kind: minor` on them with the "carry no `kind:`" clause dropped) is decided with the approver at `design` and applied to `release-planning.yaml` and `memory.yaml`; a test reads `minor-v0.3`'s frontmatter against the release `required:` list and the define-scope check's field list and asserts they agree.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** bug fixes only; dl-092 consistency.
- **Features:** P4.1.
- **Planning ruling:** Approver ruling 2026-09-30 (plan R20, Q7): bug-175 is fixed by exempting the pre-`dl-092` minors (`minor-v0.1` … `minor-v1.0`) from the define-scope `kind` check; they gain no `kind:`.
- **Notes:** Proposal key: A18 (merged: D32). runs in parallel with task-136 (different files). Tasks that change a workflow later (task-199, task-205, task-212) keep `WORKFLOW.md` in sync as part of their own change. Merged with proposal D32 (redraw of WORKFLOW.md): the redraw lands early and the phase-name test keeps it true; every later task that adds or renames a phase (task-205, task-212, task-213, task-219, task-230, task-222) updates `WORKFLOW.md` in its own change. `bug-175` is owned here, not by task-230.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
