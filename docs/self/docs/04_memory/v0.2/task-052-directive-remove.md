---
id: "task-052-directive-remove"
type: task
title: "Implement `wingfoil directive remove`"
status: pending
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "p3"]
ref: "P3.3"
bug: ""
depends_on: ["task-042-immutable-builtin-assets"]
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.3** (US-6-07): remove an unreferenced custom directive; file deleted, removal committed.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.3-directive-remove.feature`.

Key scenario: `wingfoil directive remove legacy-rule` (unassigned) → file deleted; committed; exit 0.

## Implementation Notes

Depends on REQ-SEC-07 immutable built-ins (`task-042`) — must refuse to remove built-in assets.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
