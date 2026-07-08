---
id: "task-036-frontmatter-lifecycle-validation"
type: task
title: "Infrastructure: REQ-STATE-01 — frontmatter lifecycle, per-type validated"
status: backlog
release: "v0.2"
priority: "Blocker"
tags: ["v0.2", "state"]
ref: "REQ-STATE-01"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the State constraint **REQ-STATE-01** (document state derived from frontmatter; every transition validated against the per-type state machine).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-STATE-01** in `docs/02_requirements/03_sard/03_state-context.md`.

## Implementation Notes

Consumes `memory.yaml` per-type machines (`spec-001`) + frontmatter schema (`spec-010`). Prerequisite for `wingfoil memory submit` (P1.6).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
