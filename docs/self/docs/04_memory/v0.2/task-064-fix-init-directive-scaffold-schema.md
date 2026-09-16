---
id: "task-064-fix-init-directive-scaffold-schema"
type: task
title: "Fix bug-006: `init` must scaffold directive .md that pass the directives schema"
status: in-progress
release: "v0.2"
priority: "Low"
tags: ["v0.2", "cli"]
ref: "P5.1.1"
bug: "bug-006-init-directive-scaffold-schema-invalid"
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-006**: `wingfoil init`'s `directiveMd()` generator emits `directives/**/*.md` whose frontmatter omits the required `id`, `type: directive`, and `title` fields, so `wingfoil directives list` errors `E_VALIDATION` on a fresh project.

## Acceptance Criteria

From `bug-006`:
- `wingfoil init --template Scrum` then `wingfoil directives list` succeeds (exit 0).
- Generated directive `.md` frontmatter includes `id`, `type: directive`, `title` per `spec-013`.
- Failing-first test (same defect class as bug-005) in `src/storage/templates.ts`.

## Implementation Notes

Source: `bug-006` (triaged). Same generator file as bug-005 (`src/storage/templates.ts`). Coordinate with `task-053` (directives list) + `task-064` schema. dev-loop syncs via `bug: bug-006`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
