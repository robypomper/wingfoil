---
id: bug-195-declared-frontmatter-value-sets-are-never-enforced
type: bug
title: "Declared frontmatter value sets are never enforced"
status: open
severity: "low"           # REQUIRED — critical | high | medium | low
release-origin: "v0.3"     # optional — release where the bug was FOUND (dl-016), e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog (dl-016)
feature: "P1.13"            # optional — related feature ID, e.g. "P1.6"
contributor: ""        # optional — who originated this contribution, if not the git author (dl-020); credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note (dl-020)
tmpl_version: 260703   # Orignal template version
tags: ["v0.3"]
---

## Summary

`memory.yaml` can declare a value set for a frontmatter field (`task.template.frontmatter.values.kind: [feature, fix]`, added by `task-150`; `release.kind` has `minor | patch` by `dl-092`), but no code reads it. A task submitted with `kind: "bogus"` passes.

## Steps to Reproduce

1. In a project with this repository's `memory.yaml`, add a task, set `kind: "bogus"`, then `memory submit` it.

## Expected Behavior

`submit` refuses a value outside the declared set, naming the field and the allowed values.

## Actual Behavior

The submit succeeds, `draft → pending` (reproduced by `task-150`'s independent reviewer).

## Notes

- Needs `spec-001` to declare the `values:` key and its check.

## Triage & Execution Notes

Captured on 2026-10-02 by `bug-ingest-rel-v0.3-w1b3-review-findings-plan`, from the independent reviews of wave 1
batch B3 (`dev-loop-rel-v0.3-plan`).
