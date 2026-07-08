---
id: "task-042-immutable-builtin-assets"
type: task
title: "Infrastructure: REQ-SEC-07 — immutable built-in assets"
status: backlog
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "security"]
ref: "REQ-SEC-07"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Security constraint **REQ-SEC-07** (built-in directive/workflow templates are immutable at runtime).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-SEC-07** in `docs/02_requirements/03_sard/05_security-compliance.md`.

## Implementation Notes

Protects the P3.8 built-in directive template set; consumed by `directive remove` (P3.3).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
