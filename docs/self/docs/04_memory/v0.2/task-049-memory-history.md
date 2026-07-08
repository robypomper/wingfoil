---
id: "task-049-memory-history"
type: task
title: "Implement `wingfoil memory history`"
status: backlog
release: "v0.2"
priority: "High"
tags: ["v0.2", "p1"]
ref: "P1.10"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

As Casey, deliver feature **P1.10** (US-5-08): view the full audit trail of a document (author, ISO-8601 timestamp, state change, reason per entry) in chronological order.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.10-memory-history.feature`.

Key scenario: `wingfoil memory history decision-12` → chronological entries, each with author/timestamp/state-change/reason; query < 1s.

## Implementation Notes

Reads the git-derived audit trail (`dl-011`, P1.10). Surfaces the `Approver:`/`Reason:` commit-body convention.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
