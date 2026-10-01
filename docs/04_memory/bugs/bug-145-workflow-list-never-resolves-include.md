---
id: "bug-145-workflow-list-never-resolves-include"
type: bug
title: "`workflow list` never checks that a phase's `include` resolves to a known workflow name, so an unresolvable path is echoed back with no warning"
status: in-progress
severity: "medium"
release-origin: "v0.2"
release: "v0.3"
feature: "P4.6"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

A phase's `include:` value is meant to name an already-loaded sub-workflow (its declared `name:`),
but `workflow list` performs no cross-check that the string it prints actually matches a loaded
workflow's name. A path written there instead — exactly what the stock Kanban scaffold itself does
(see the companion template bug) — parses fine and is echoed back completely unresolved, with no
warning and exit `0`.

## Steps to Reproduce

Reproduced against `wingfoil@0.2.1`, fresh project, stock scaffold, no manual edits:

1. `wingfoil init --template Kanban < /dev/null`
2. `wingfoil workflow list --format json` → exit `0`; the `sw-life-cycle` workflow's `delivery`
   phase is printed as
   `{"name":"delivery","optional":false,"include":"workflows/custom/kanban-delivery.yaml"}` — the
   raw manifest string, not the resolved `kanban-delivery` sub-workflow's phases, and the top-level
   payload carries no `warnings` entry (nor any other field) calling this out.
3. `grep -n "include" src/workflow/schema.ts` shows `include: z.string().optional()` on `Phase` —
   a free string with no enum/reference constraint against the set of loaded workflow `name`s.
4. `grep -n "phase.include\|p.include" src/core/loaders.ts src/workflow/*.ts` finds no cross-file
   check resolving a phase's `include` against the loaded workflow registry (the module-level
   doc-comment in `src/workflow/schema.ts` itself says cross-file checks "run as a list of
   caller-supplied `SemanticCheck` functions" in the loader — no such function exists for this case).

## Expected Behavior

`workflow list` either resolves a phase's `include` to the loaded sub-workflow's phases, or reports
a warning when the value names nothing that was loaded (mirroring the "at least one workflow is
`kind: main`" cross-file check spec-003 already requires the loader to perform).

## Actual Behavior

An unresolvable `include` — file path, typo, or a name that no workflow declares — is accepted
silently and echoed back verbatim.

## Notes

- Root cause: spec-003's declared cross-file checks (`include` path resolution at the manifest level,
  "at least one `kind: main`") do not extend to phase-level `include` name resolution, so no
  `SemanticCheck` in `src/core/loaders.ts` covers it.
- Gate: `e2e-smoke` runs `wingfoil workflow list` against this repository's own hand-verified
  `workflows.yaml`, where every `include` already happens to be correct, so an automated assertion
  that a phase's `include` actually resolves to something was never exercised — the defect is present
  in the very scaffold a fresh consumer project starts from, and no CI signal would catch it there
  either.
- Fix: add a `SemanticCheck` that every phase-level `include` matches a loaded workflow's `name`,
  reporting a warning (or refusing) rather than passing the raw string through.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (retro-v0.2); reproduced independently from the stock
  Kanban scaffold, no external report needed.
