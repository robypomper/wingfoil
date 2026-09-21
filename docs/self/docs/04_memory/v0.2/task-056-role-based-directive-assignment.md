---
id: "task-056-role-based-directive-assignment"
type: task
title: "Implement Role-Based Directive Assignment"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "p3"]
ref: "P3.7"
bug: ""
depends_on: ["task-034-role-based-binding"]
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.7** (US-4-06): bind multiple directives to one role.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.7-role-based-assignment.feature`.

Key scenario: assign `testing`+`code-quality`+`security` to `developer` → role lists exactly those 3.

## Implementation Notes

Depends on REQ-SYS-08 (`task-034`). Complements the `directive assign` verb (P3.2).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
