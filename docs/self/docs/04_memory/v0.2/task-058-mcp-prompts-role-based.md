---
id: "task-058-mcp-prompts-role-based"
type: task
title: "Implement MCP Prompts (role-based)"
status: pending
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p5"]
ref: "P5.2.2"
bug: ""
depends_on: ["task-039-mcp-prompts-role-based-infra"]
tmpl_version: 260703
---

## Description

As an Agent, deliver feature **P5.2.2** (US-1-06): auto-load the role prompt at MCP session start, embedding the role's directives.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p5-interaction/P5.2.2-mcp-prompts.feature`.

Key scenario: session under `developer` → MCP prompt for `developer` returned, embedding `testing` + `code-quality`.

## Implementation Notes

Depends on REQ-INT-02 infra (`task-039`). MCP surface per `spec-004`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
