---
id: "task-047-memory-reject"
type: task
title: "Implement `wingfoil memory reject`"
status: in-progress
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p1"]
ref: "P1.8"
bug: ["bug-041-frontmatter-edit-yaml-edge-cases"]
depends_on: ["task-041-mandatory-reason-on-verbs"]
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P1.8** (US-4-11): reject a pending document with feedback; frontmatter returns to `draft` and the commit records rejecter identity, timestamp, and reason.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.8-memory-reject.feature`.

Key scenario: `wingfoil memory reject task-101 --reason 'tests missing'` → `status: draft`; commit records reason; exit 0.

## Implementation Notes

Depends on REQ-SEC-04 mandatory reason (`task-041`). Also sets `rejection_reason` frontmatter per the reject convention.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
