---
id: "task-046-memory-approve"
type: task
title: "Implement `wingfoil memory approve`"
status: pending
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p1"]
ref: "P1.7"
bug: ""
depends_on: ["task-040-role-based-approval-authority", "task-041-mandatory-reason-on-verbs"]
tmpl_version: 260703
---

## Description

As Sam, deliver feature **P1.7** (US-2-10): approve a pending document with a mandatory reason; the commit records approver identity, ISO-8601 timestamp, and reason.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.7-memory-approve.feature`.

Key scenario: `wingfoil memory approve task-101 --reason 'meets standards'` → advances to approved state; commit records approver + timestamp + reason; exit 0.

## Implementation Notes

Depends on REQ-SEC-03 approval authority (`task-040`) + REQ-SEC-04 mandatory reason (`task-041`). Mirrors the manual `wf(...): approve` commit convention this planning phase used.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
