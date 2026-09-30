---
id: bug-166-release-field-means-two-things-on-a-service
type: bug
title: "A `service`'s `release` field means the release it was set up in, while the `traceability` directive gives `release` one uniform meaning, the release the work is assigned to"
status: planned
severity: "low"
release-origin: "v0.2.2"
release: "v0.3"
feature: "P1.13"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`task-124` added the `service` type (`dl-088`). Its optional `release` field means "the release in
which it was set up" (`.wingfoil/memory/templates/service.md`, line 15). The `traceability`
directive (`.wingfoil/directives/custom/traceability.md`, lines 24–27) gives `release` on base
documents one uniform meaning: "the release this element's implementation is assigned to"
(`== task.release`), stamped by `release-planning`'s `build-backlog`. That phase's
`element.set_release("{release.version}")` stamps "every included DL, bug, tech-spec, adr, task"
(`release-planning.yaml`, `build-backlog`). So a `service` carries a field that a reader, a query
(`grep -r "^release:"`) or a future planning sweep reads with the other meaning.

## Steps to Reproduce

1. On `main` at `a9523820` or later, read `release` in `.wingfoil/memory/templates/service.md` and in
   `.wingfoil/directives/custom/traceability.md`.
2. Run `grep -rh "^release:" docs/04_memory/services docs/04_memory/bugs | sort | uniq -c`. The field
   name is the same, and the meanings differ.

## Expected Behavior

One field name, one meaning. Either the `service` field is renamed (e.g. `set_up_in`), or the
directive and `build-backlog` state that `service` is outside the uniform `release` meaning and is
never stamped.

## Actual Behavior

The same name means two things. Nothing stops a planning sweep that selects by `release` from
treating a service as scheduled work.

## Notes

- Found by `task-124`'s implementer and raised at its review (2026-09-29). The approver ruled it a
  bug.
- `element.set_release` does not include `service` in its list today, so no sweep stamps one yet.
  The risk is in reading and querying, and in any later widening of that list.
- `dl-088` §Frontmatter introduced the field. The fix probably touches `dl-088`'s table, the
  template, and either the directive or `spec-001`.

## Triage & Execution Notes

<!-- triage (bug-ingest): severity call; fix: pointer to the fix task(s). -->
