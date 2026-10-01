---
id: "task-136-validate-workflows-startable-includable-resolve-phase-include-name"
type: task
title: "Validate workflows as startable/includable, resolve phase `include` by name, and emit one ordered diagnostics array"
status: in-progress
release: "v0.3"
kind: "feature"
priority: "high"
tags: ["v0.3", "workflow", "schema", "loader"]
ref: "dl-109"
bug: ["bug-144", "bug-145"]
depends_on: []
tmpl_version: 260703
---

## Description

The loader today requires `kind: main|sub` and never resolves a phase's `include`, so the Kanban scaffold's include-by-path passes (`bug-144`) and `workflow list` echoes an unresolvable value (`bug-145`). This task replaces the Layer-1/Layer-2 structural rules with the revised `spec-003`: the `startable`/`includable` booleans with `kind` as alias, the name class for workflows and phases (`adhoc` reserved), phase `include` as a workflow name that must resolve to an includable workflow, element compatibility, include cycles, `fallback.step` existence, and the diagnostics model `{ code, severity, file, path, message }` in `spec-003`'s deterministic order. It fixes the Kanban template in `src/storage/templates.ts` in the same change.

## Acceptance Criteria

- (red-first) Each loader row of `spec-003` § Diagnostics owned here fires on a minimal fixture with its code, severity, `file`, `path` and message: `E_WORKFLOW_INVALID_KIND` (message `invalid workflow kind 'hybrid' (allowed: main, sub)`, BDD P4.1 sc. 3), `E_WORKFLOW_NAME_INVALID`, `E_WORKFLOW_DUPLICATE_NAME`, `E_WORKFLOW_KIND_CONFLICT`, `E_WORKFLOW_NEITHER_STARTABLE_NOR_INCLUDABLE`, `E_NO_MAIN_WORKFLOW` (now "no startable workflow"), `E_PHASE_NAME_INVALID`, `E_PHASE_NAME_RESERVED`, `E_PHASE_DUPLICATE_NAME`, `E_WORKFLOW_INCLUDE_UNRESOLVED` (a path-shaped value included), `E_WORKFLOW_NOT_INCLUDABLE`, `E_WORKFLOW_ELEMENT_MISMATCH`, `E_WORKFLOW_INCLUDE_CYCLE` (message `include cycle: <w1> -> … -> <w1>`), `E_PHASE_FALLBACK_STEP_UNKNOWN` (message `fallback step '<step>' not found in workflow`, BDD P4.15 sc. 3 as amended by spec-017 Consequences).
- (red-first) `kind: main` loads as startable-only and `kind: sub` as includable-only; a workflow declaring only `includable: true` is not startable (BDD P4.1 sc. 1–2).
- (red-first) An absent `.wingfoil/workflows.yaml` loads as an empty registry with no diagnostic (spec-003 Layer 1; BDD P4.6 sc. 4 groundwork).
- (red-first) Diagnostics come out in `spec-003`'s order (manifest, then files in `include` order, workflow-level before phase-level, table order per field); a test loads a fixture with several errors twice and asserts byte-identical arrays (REQ-SYS-07). The first error is the `VALIDATION` reason (exit 1) and every diagnostic is in `details`.
- (red-first) `wingfoil init --template Kanban` writes `include: kanban-delivery` and the scaffold loads with zero errors (`bug-144`); a test asserts every built-in template (default, Scrum, Kanban) loads with zero errors under the new loader (P4.17 integrity unchanged).
- (characterization) Every file under this repository's `.wingfoil/workflows/custom/` loads with no error from this task's rules (spec-003 § Names measured none).
- (characterization) `docs/01_vision/06_features.md` P4.2 and P4.6 descriptions speak of startable/includable workflows (`dl-109` Action 3), with a `doc-versioning` bump.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-109 K1 (a), K3; spec-003 Layer 1 (absent manifest, startable rule), Layer 2 top-level fields, § Names, § Diagnostics (shape, order, "runs in").
- **Features:** P4.1, P4.16.
- **Notes:** Proposal key: A01. files `src/workflow/schema.ts`, `src/core/loaders.ts` (semantic checks), `src/validation/` if the diagnostics type lives there, `src/storage/templates.ts`. The `workflow list` payload keeps its shape here; task-204 reshapes it.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
