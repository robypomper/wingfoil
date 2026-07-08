---
id: "task-057-builtin-directive-templates"
type: task
title: "Implement Built-in Directive Templates (6 types)"
status: pending
release: "v0.2"
priority: "High"
tags: ["v0.2", "p3"]
ref: "P3.8"
bug: ""
depends_on: ["task-043-secret-credential-hygiene", "task-044-builtin-template-integrity"]
tmpl_version: 260703
---

## Description

As Alex, deliver feature **P3.8** (US-0A-09): install exactly 6 built-in directive templates during init (code-quality, testing, code-review, architecture, security, documentation).

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.8-builtin-directive-templates.feature`.

Key scenario: after init, `.wingfoil/directives/built-in/` contains exactly the 6-template set.

## Implementation Notes

Depends on REQ-SEC-08/10 (`task-043`/`task-044`). Replaces the interim `custom/` stand-ins (see CLAUDE.md §3). `directives/built-in/` is empty today.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
