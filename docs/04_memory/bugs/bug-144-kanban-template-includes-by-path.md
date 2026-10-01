---
id: "bug-144-kanban-template-includes-by-path"
type: bug
title: "The Kanban template's `sw-life-cycle.yaml` includes its delivery sub-workflow by file path, where a workflow `include` is documented to take a name"
status: in-progress
severity: "medium"
release-origin: "v0.2"
release: "v0.3"
feature: "P4.16"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The stock `Kanban` template's `sw-life-cycle.yaml` phase `delivery` writes
`include: workflows/custom/kanban-delivery.yaml` — a file path — even though a phase's `include:`
key is meant to name a workflow (`kanban-delivery`, the `name:` declared inside that file), the same
key the top-level `workflows.yaml` manifest uses for a literal path. The two uses of `include`
share one key and one string type but mean different things, and the shipped scaffold itself uses
the wrong one.

## Steps to Reproduce

Reproduced against `wingfoil@0.2.1`, fresh project, no edits beyond the stock scaffold:

1. `wingfoil init --template Kanban < /dev/null`
2. `grep -n "include:" .wingfoil/workflows/custom/sw-life-cycle.yaml` →
   `include: workflows/custom/kanban-delivery.yaml` on the `delivery` phase.
3. `grep -n "^name:" .wingfoil/workflows/custom/kanban-delivery.yaml` → `name: kanban-delivery` — the
   value the phase's `include` should have referenced by name, not by the path to the file that
   declares it.
4. `wingfoil workflow list --format json` echoes the phase back with
   `"include": "workflows/custom/kanban-delivery.yaml"` unresolved (see the companion bug on
   `workflow list` for the validator side of this gap) — the shipped scaffold demonstrates the wrong
   usage is silently accepted, not merely theoretically possible.

## Expected Behavior

The template writes `include: kanban-delivery` (the workflow's declared `name:`), matching how a
phase-level `include` is meant to reference an already-loaded sub-workflow.

## Actual Behavior

The template writes the path to the file instead, which — because both the manifest-level and the
phase-level `include` are plain, untyped strings in the schema — parses without error and silently
resolves to nothing at the phase level.

## Notes

- Root cause: `src/workflow/schema.ts`'s `Phase.include` and `WorkflowsYaml.include` are both bare
  `z.string()`/`z.array(z.string())` with no structural distinction between "a file path" (Layer 1)
  and "a workflow name" (Layer 2) — so a scaffold author copying the visible pattern from the
  manifest's own `include:` list can plausibly write the wrong form at the phase level, which is
  exactly what happened here.
- Fix: correct the template to `include: kanban-delivery`. The retrospective's disposition also
  opens a second bug for the validator that should have caught this — `workflow list` accepting an
  `include` that never resolves to any loaded workflow — so the template fix and the missing
  cross-check are tracked separately rather than as one item.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (retro-v0.2); reproduced independently from the stock
  scaffold with no external report needed.
