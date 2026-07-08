---
id: "task-048-memory-deprecate"
type: task
title: "Implement `wingfoil memory deprecate`"
status: pending
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "p1"]
ref: "P1.9"
bug: ""
depends_on: ["task-035-bounded-context-relevance", "task-038-deprecated-excluded-from-context", "task-041-mandatory-reason-on-verbs"]
tmpl_version: 260703
---

## Description

As Casey, deliver feature **P1.9** (US-5-04): deprecate an approved document; frontmatter becomes `status: deprecated`, file remains present.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.9-memory-deprecate.feature`.

Key scenario: `wingfoil memory deprecate decision-12 --reason 'superseded by decision-20'` → `status: deprecated`; file retained; exit 0.

## Implementation Notes

Depends on REQ-STATE-06 deprecated-exclusion (`task-038`). Callable from any state per the type machines (`spec-001`).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
