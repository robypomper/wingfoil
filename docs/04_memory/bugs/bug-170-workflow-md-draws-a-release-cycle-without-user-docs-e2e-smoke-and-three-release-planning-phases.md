---
id: bug-170-workflow-md-draws-a-release-cycle-without-user-docs-e2e-smoke-and-three-release-planning-phases
type: bug
title: "WORKFLOW.md draws a release cycle without user-docs, e2e-smoke and three release-planning phases"
status: in-review
severity: "low"
release-origin: "v0.2.2"
release: "v0.3"
feature: "P4.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`.wingfoil/WORKFLOW.md`, the human-readable reference of this repository's workflows, draws
`release-cycle` and `release-planning` as they were before `dl-013`, `dl-016`, `dl-023` and `dl-095`
landed:
- two of the seven release phases are missing;
- three of the eight release-planning phases are missing;
- `e2e-smoke`'s `mcp-registration` phase is missing.

## Steps to Reproduce

1. On `docs/user_docs_v0.2.2` at `b01432d9`, list the phases the configuration declares:
   `grep -E '^  - name:' .wingfoil/workflows/custom/release-cycle.yaml` →
   `planning implementation user-docs e2e-smoke submit publishing retrospective`.
2. `grep -E '^  - name:' .wingfoil/workflows/custom/release-planning.yaml` →
   `advance-pinned-build define-scope triage-bugs reconcile-governance record-adrs identify-specs build-backlog commit-backlog`.
3. Count each missing phase in the reference:
   `for w in triage-bugs reconcile-governance advance-pinned-build user-docs e2e-smoke mcp-registration align-agent-docs; do printf "%s:%s " $w $(grep -c "$w" .wingfoil/WORKFLOW.md); done`
   → every count is `0`.
4. The *Release Cycle* diagram in `WORKFLOW.md` introduces itself as "Five sub-phases in sequence".
   Its flowchart runs `release-planning → dev-loop → release-submit → release-publishing →
   retrospective`, and its `release-planning` node reads
   `define-scope → record-adrs (opt.) → identify-specs → build-backlog → commit-backlog`.

## Expected Behavior

`WORKFLOW.md` draws what `workflows.yaml` includes:
- `release-cycle` with seven phases, `user-docs` (with `align-user-docs` and `align-agent-docs`) and
  `e2e-smoke` (with `mcp-registration`) between `dev-loop` and `release-submit`;
- `release-planning` with its eight phases, in order;
- a sub-diagram for each of the two gates, as the other sub-workflows have.

## Actual Behavior

The reference omits the two release gates that most often block a release (`user-docs`,
`e2e-smoke`), the two dl-016 governance sweeps, and the pinned-build step. A reader who follows the
diagram skips them.

## Notes

- **Found** by `user-docs-rel-v0.2.2-plan` S10 (`align-agent-docs`). Its produces are `CLAUDE.md`
  and `.wingfoil/README.md`, and both were aligned. `WORKFLOW.md` sits next to them but is in no
  phase's `produces:`, so it is filed here (`bug-ingest-rel-v0.2.2-user-docs-findings-plan`).
- **Why it drifted:** each DL that added a phase (dl-013, dl-016, dl-023, dl-025, dl-095) edited the
  workflow YAML and `CLAUDE.md`. `WORKFLOW.md` was updated only by tasks that touched Memory state
  machines (`task-114`, `task-124`: `git log --format=%s -- .wingfoil/WORKFLOW.md`). No gate checks
  it against `workflows.yaml`, so a fix could also add it to `align-agent-docs`' `produces:`.
- **Duplicate search:** `grep -rl -i 'WORKFLOW.md' docs/04_memory/bugs` → `bug-159` (spec-011's tree,
  closed) and `bug-060` (the `act` recipe), neither about its content.

## Triage & Execution Notes

<!-- Filled at triage (bug-ingest) and by the fix task. -->
