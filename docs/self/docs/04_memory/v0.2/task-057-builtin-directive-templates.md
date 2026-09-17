---
id: "task-057-builtin-directive-templates"
type: task
title: "Implement Built-in Directive Templates (6 types)"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "p3"]
ref: "P3.8"
bug: ""
depends_on: ["task-043-secret-credential-hygiene", "task-044-builtin-template-integrity", "task-064-fix-init-directive-scaffold-schema"]
tmpl_version: 260703
---

## Description

As Alex, deliver feature **P3.8** (US-0A-09): install exactly 6 built-in directive templates during init (code-quality, testing, code-review, architecture, security, documentation).

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.8-builtin-directive-templates.feature`.

Key scenario: after init, `.wingfoil/directives/built-in/` contains exactly the 6-template set.

## Implementation Notes

**`task-064` must land before this task adds any file under `directives/built-in/`.** `task-044`
replaced the built-in registry with derivation from the scaffold, so adding the scaffold file alone
arms the integrity check — there is no longer a registry edit that could be forgotten, and equally no
longer one that could be delayed. With `bug-006` unfixed, `directiveMd()` emits `name`/`kind`/`ref`
while `DirectiveFrontmatter` requires `id`/`type`/`title`, so `wingfoil init` aborts for every user.
Verified empirically by `task-044` and its reviewer, both of whom reproduced
`built-in directive template integrity check failed: architecture`. The alternative is for this task
to emit schema-valid frontmatter itself. The `depends_on` edge above was added so the constraint is
structural rather than carried narratively through `task-044`'s Execution Notes.


Depends on REQ-SEC-08/10 (`task-043`/`task-044`). Replaces the interim `custom/` stand-ins (see CLAUDE.md §3). `directives/built-in/` is empty today.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
