---
id: "task-059-publish-metadata"
type: task
title: "Publish metadata: complete package.json publish surface (dl-018 T1)"
status: backlog
release: "v0.2"
priority: "High"
tags: ["v0.2", "release"]
ref: "dl-018-release-publishing-strategy"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Deliver **dl-018 T1**: add the npm publish metadata `package.json` currently lacks so the package is publishable (not just packable). Implements `spec-015` §1.

## Acceptance Criteria

Per `spec-015` §1:
- Add `repository`, `author`, `homepage`, `bugs`.
- Add `publishConfig: { registry, access: public, provenance: true }`.
- Review `files` (stays `[dist, README.md]` + `LICENSE`/`COLLABORATION.md` if intended); **no** `.npmignore`.
- `npm pack` manifest = exactly `dist` + docs.

## Implementation Notes

Source: `dl-018` `## Actions` T1; governed by `spec-015` (approved) + `adr-009`; requirement REQ-SYS-09. First publishing task (others depend on it).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
