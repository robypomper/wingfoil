---
id: "task-053-directives-list"
type: task
title: "Implement `wingfoil directives list`"
status: pending
release: "v0.2"
priority: "High"
tags: ["v0.2", "p3"]
ref: "P3.4"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.4** (US-4-04): list all directives with their role assignments.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.4-directives-list.feature`.

Key scenario: `wingfoil directives list` → 6 built-ins + customs, each with assigned roles or `unassigned`.

## Implementation Notes

Must not repeat `bug-006` (init-scaffolded directive .md failing the schema) — see `task-064`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
