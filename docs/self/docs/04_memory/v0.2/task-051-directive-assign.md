---
id: "task-051-directive-assign"
type: task
title: "Implement `wingfoil directive assign`"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "p3"]
ref: "P3.2"
bug: ""
depends_on: ["task-034-role-based-binding"]
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.2** (US-4-05): assign a directive to a role.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.2-directive-assign.feature`.

Key scenario: `wingfoil directive assign --directive testing --role developer` → role lists `testing`; exit 0.

## Implementation Notes

Depends on REQ-SYS-08 role-based binding (`task-034`). Writes `roles.yaml`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
