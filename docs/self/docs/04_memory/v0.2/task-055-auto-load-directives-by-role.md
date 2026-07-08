---
id: "task-055-auto-load-directives-by-role"
type: task
title: "Implement Auto-Load Directives by Role"
status: pending
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p3"]
ref: "P3.6"
bug: ""
depends_on: ["task-037-role-task-scoped-context", "task-039-mcp-prompts-role-based-infra"]
tmpl_version: 260703
---

## Description

As Jordan, deliver feature **P3.6** (US-3-06): directives auto-load into agent context at task execution, per the active role.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.6-auto-load-by-role.feature`.

Key scenario: agent under `developer` → context includes `testing` + `code-quality`; 100% of the role's directives present.

## Implementation Notes

Depends on REQ-STATE-05 role/task-scoped context (`task-037`) + REQ-INT-02 (`task-039`). Realizes the `roles.yaml` bindings.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
