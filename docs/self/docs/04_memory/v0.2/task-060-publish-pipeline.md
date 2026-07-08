---
id: "task-060-publish-pipeline"
type: task
title: "Publish flow: GitHub Actions CI/CD + ephemeral Verdaccio staging (dl-018 T3)"
status: backlog
release: "v0.2"
priority: "High"
tags: ["v0.2", "release"]
ref: "dl-018-release-publishing-strategy"
bug: ""
depends_on: ["task-059-publish-metadata"]
tmpl_version: 260703
---

## Description

Deliver **dl-018 T3**: implement the publish pipeline per `adr-009` — `prepublishOnly` + `npm publish --dry-run` gate, a local-first `publish:staging` script (Verdaccio) reused as the CI staging smoke, then promote to npm with provenance/OIDC. Implements `spec-015` §2–§4.

## Acceptance Criteria

Per `spec-015` §2–§4 + `adr-009`:
- `prepublishOnly = build && test && lint`.
- `publish:staging` script: publish to ephemeral Verdaccio → `npm install -g wingfoil` from it → run the `dl-023` init+CLI e2e smoke → teardown.
- `.github/workflows/publish.yml`: gate → stage → smoke → promote (provenance via OIDC) on `vX.Y.Z` tag on `main`.
- Document local `act` run to avoid CI-debug commit churn.

## Implementation Notes

Source: `dl-018` T3; architecture fixed by `adr-009`; contract in `spec-015`; requirement REQ-SYS-09. Reuses the `dl-023` smoke sub-workflow.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
