---
id: "task-061-publish-secrets"
type: task
title: "Publish secrets: CI secret store + rollback posture (dl-018 T4)"
status: pending
release: "v0.2"
priority: "High"
tags: ["v0.2", "release"]
ref: "dl-018-release-publishing-strategy"
bug: ""
depends_on: ["task-060-publish-pipeline"]
tmpl_version: 260703
---

## Description

Deliver **dl-018 T4**: wire the registry token as a CI secret (never committed) and document the human approval/rollback steps. Implements `spec-015` §5.

## Acceptance Criteria

Per `spec-015` §5 + `security-secrets`/`spec-007`:
- `NPM_TOKEN` in the GitHub Actions secret store only; transient `.npmrc` at publish time; never committed.
- Document the `approver` (Roberto) providing/rotating the secret + authorizing the tagged release (`adr-006`).
- Rollback posture: prefer `npm deprecate` + patch over `npm unpublish`; failed staging smoke blocks promotion.

## Implementation Notes

Source: `dl-018` T4; contract `spec-015` §5; requirement REQ-SYS-09/REQ-SEC-08. Depends on the pipeline (`task-060`).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
