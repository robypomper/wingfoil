---
id: "task-054-project-directives"
type: task
title: "Implement Project Directives (custom + built-in storage layout)"
status: backlog
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p3"]
ref: "P3.5"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.5** (US-4-03): the directive storage layout (`built-in/` + `custom/`) exists after init and is git-tracked.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.5-project-directives.feature`.

Key scenario: `.wingfoil/directives/` contains `built-in/` and `custom/`, both git-tracked.

## Implementation Notes

Layout per `spec-011`. Core of the Directives pillar.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
