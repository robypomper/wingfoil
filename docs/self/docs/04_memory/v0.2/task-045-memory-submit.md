---
id: "task-045-memory-submit"
type: task
title: "Implement `wingfoil memory submit`"
status: backlog
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p1"]
ref: "P1.6"
bug: ""
depends_on: ["task-036-frontmatter-lifecycle-validation"]
tmpl_version: 260703
---

## Description

As Jordan, deliver feature **P1.6** (US-3-09): submit a draft document for approval, moving it to the type's post-submit state and recording the transition in git.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.6-memory-submit.feature`.

Key scenario: `wingfoil memory submit task-101` → frontmatter `status: pending`, transition recorded in git, exit 0.

## Implementation Notes

Depends on REQ-STATE-01 frontmatter lifecycle (`task-036`). First of the v0.2 memory verbs.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
