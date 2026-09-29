---
id: "bug-159-storage-layout-spec-tree-omits-three-configuration-files"
type: bug
title: "`spec-011`'s directory tree, which claims to be the ground truth of `.wingfoil/`, omits three files the configuration holds: `memory/templates/plan.md`, `workflows/custom/user-docs.yaml`, `workflows/custom/e2e-smoke.yaml`"
status: planned
severity: "low"
release-origin: "v0.2.2"
release: "v0.2.2"
feature: "P1.13"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`spec-011-storage-layout` (`approved`) heads its tree "ground truth: `.wingfoil/`, verified via
`find .wingfoil -maxdepth 4`". Three files that `.wingfoil/` holds are not in it:
`memory/templates/plan.md` (the `plan` type, `dl-019`), `workflows/custom/user-docs.yaml` (`dl-013`)
and `workflows/custom/e2e-smoke.yaml` (`dl-023`). Each was added by a change that did not revise the
spec.

## Steps to Reproduce

1. On `main` at `582ec08a` or later, list the file names in the tree block of
   `docs/04_memory/design/specs/spec-011-storage-layout.md` (lines 33–101).
2. List the files under `.wingfoil/` (`find .wingfoil -maxdepth 4 -type f -printf '%f\n'`).
3. Compare the two lists: `comm -23` of the sorted lists, ignoring `.gitkeep` and the upper-case
   `README.md` and `WORKFLOW.md` that the lower-case extraction misses.

## Expected Behavior

The tree lists every file the configuration holds, or it stops calling itself the ground truth and
says which files it leaves out on purpose.

## Actual Behavior

The three files are named only in the 2026-09-29 revision note (lines 235–236), which records the gap
rather than closing it. They are not in the tree (`grep -n "plan.md\|user-docs.yaml\|e2e-smoke.yaml"
spec-011-storage-layout.md` → only lines 235–236).

## Notes

- Found at `task-111`'s review (2026-09-29). `task-111` measured it while moving the configuration to
  the root and recorded it in `spec-011`'s revision note. The approver ruled it a bug.
- Nothing checks the tree against the configuration, so the same drift will come back with the next
  added file. The fix can add the three entries. It can also add a test that compares the tree with
  `find .wingfoil`, so the spec cannot drift again unnoticed.
- Related, other defects of the same spec, both `open`: `bug-053` (the `memory.yaml` row describes the
  retired `states` encoding) and `bug-040` (the `built-in/` text is stale since `task-057`). A single
  fix task could take all three.
- `dl-088`'s `service` type will add `memory/templates/service.md` and a `service-ingest` workflow,
  two more entries the tree will need.

## Triage & Execution Notes

- Triaged 2026-09-29 into v0.3 (`9a38cd9e`). Absorbed the same day into
  `task-124-the-service-memory-type` (`dl-045`), whose `spec-011` revision rewrote the tree with every
  file under `.wingfoil/`, the three named here included. `release` moved to v0.2.2 on the
  approver's ruling at `task-124`'s review.
