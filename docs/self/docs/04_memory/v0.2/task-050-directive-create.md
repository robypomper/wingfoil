---
id: "task-050-directive-create"
type: task
title: "Implement `wingfoil directive create`"
status: pending
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p3"]
ref: "P3.1"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.1** (US-4-02): create a new custom directive under `.wingfoil/directives/custom/`, committed to git.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.1-directive-create.feature`.

Key scenario: `wingfoil directive create --name no-direct-db-access` → file under `custom/`; committed; exit 0.

## Implementation Notes

First Directives-pillar CLI verb. Directive frontmatter per `spec-013`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
