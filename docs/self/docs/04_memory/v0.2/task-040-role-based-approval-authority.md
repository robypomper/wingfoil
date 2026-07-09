---
id: "task-040-role-based-approval-authority"
type: task
title: "Infrastructure: REQ-SEC-03 — role-based approval authority"
status: in-progress
release: "v0.2"
priority: "Blocker"
tags: ["v0.2", "security"]
ref: "REQ-SEC-03"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Security constraint **REQ-SEC-03** (only the `approver` role may approve; agents never self-approve).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-SEC-03** in `docs/02_requirements/03_sard/05_security-compliance.md`.

## Implementation Notes

Grounds `adr-006`. Gates `wingfoil memory approve` (P1.7).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
