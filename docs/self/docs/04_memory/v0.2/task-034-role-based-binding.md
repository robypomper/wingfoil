---
id: "task-034-role-based-binding"
type: task
title: "Infrastructure: REQ-SYS-08 — role-based directive/approval binding"
status: backlog
release: "v0.2"
priority: "Blocker"
tags: ["v0.2", "architecture"]
ref: "REQ-SYS-08"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Architecture constraint **REQ-SYS-08** (role-based binding: directives and approval authority reference roles, never named persons). Foundation for the Directives pillar (P3) and the memory approval verbs.

## Acceptance Criteria

Satisfies the measurable Fit Criterion for **REQ-SYS-08** in `docs/02_requirements/03_sard/01_architecture.md`.

## Implementation Notes

Grounds `adr-006` (git identity + role-based authority). Enables P3.2/P3.7 assignment and P1.7 approval gating.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
