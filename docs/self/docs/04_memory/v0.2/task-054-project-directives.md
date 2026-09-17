---
id: "task-054-project-directives"
type: task
title: "Implement Project Directives (custom + built-in storage layout)"
status: in-progress
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p3"]
ref: "P3.5"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.5** (US-4-03): the directive storage layout (`built-in/` + `custom/`) exists after init and is git-tracked.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.5-project-directives.feature`.

Key scenario: `.wingfoil/directives/` contains `built-in/` and `custom/`, both git-tracked.


**`bug-018` — close the guard-5 bypass this task's own change opens.** `scaffoldFiles()`
(`src/storage/layout.ts`) currently emits a flat `.wingfoil/directives/.gitkeep`. Satisfying this
task's AC means it will emit `directives/built-in/` — and `initWingfoilStorage` writes that scaffold
via `initStorage(root)` at `src/core/init.ts:75` **without guard 5**, unlike `initWingfoilProject`
which derives sources and verifies at lines 143-150.

Nothing escapes today, because `builtinSourceOf` excludes dotfiles and `.gitkeep` is one. But after
this task the `built-in/` directory exists on a write path that checks nothing, and the only thing
standing between that and an unchecked built-in asset is that nobody has put a non-dotfile there yet.
`task-044`'s reviewer named this exact scenario: *"if a future task ever put a built-in asset into the
minimal skeleton it would reproduce the shape task-044 was rejected for"*. This is that task.

Close it here rather than leaving it: `builtinTemplateSources` is already generic over
`ScaffoldFile[]`, so running the same derivation plus `verifyBuiltinTemplates` over `scaffoldFiles()`
in `initWingfoilStorage` is roughly one line. Pair it with a test asserting **both** write paths check,
so the symmetry is pinned rather than re-derived. `bug-018` needs closing by hand afterwards — it
carries no `bug:` back-reference from this task, so `bug.sync_state` will not advance it.
## Implementation Notes

Layout per `spec-011`. Core of the Directives pillar.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
