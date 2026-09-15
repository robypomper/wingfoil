---
id: "task-055-auto-load-directives-by-role"
type: task
title: "Implement Auto-Load Directives by Role"
status: backlog
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


**`dl-037` — directive precedence and shadow reporting (assigned by `dl-037`, ratified A.1 + B.1).**
Two behaviours land here because this task already consumes `resolveRoleDirectives` and already owns
rendering its `warnings` channel:

1. **`custom/` wins over `built-in/`** when two directives share an id. `task-037` shipped the
   opposite by accident — it broke the tie on shortest path, so `directives/built-in/…` won because
   `'b'` sorts before `'c'` — and pinned that in a test. Flip the comparator in `src/core/context.ts`'s
   dedup and flip that test. `spec-012` §5 now states the rule.
2. **The shadowed directive is reported**, through the same `warnings` array that carries `dl-029`'s
   no-assignments message — naming the id and which file won. Render both warnings; nothing surfaces
   them to an operator until this task does.

Urgency: `task-057-builtin-directive-templates` ships the six built-ins whose ids are exactly the six
`custom/` stand-ins, so every one becomes a live duplicate the moment it lands.
## Implementation Notes

Depends on REQ-STATE-05 role/task-scoped context (`task-037`) + REQ-INT-02 (`task-039`). Realizes the `roles.yaml` bindings.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
