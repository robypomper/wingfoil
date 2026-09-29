---
id: "task-119-init-names-its-templates-and-a-real-remedy"
type: task
title: "`init` names its available templates, and its already-initialised error names a remedy that exists"
status: in-progress
release: "v0.2.2"
priority: "low"
tags: ["v0.2.2", "init", "cli", "first-use"]
ref: "bug-140-init-never-names-its-templates"
bug: ["bug-140-init-never-names-its-templates", "bug-129-init-error-names-a-migration-command-that-does-not-exist"]
depends_on: []
tmpl_version: 260703
---

## Description

Two `init` messages mislead a first user. The task fixes both and closes `bug-140` and `bug-129`.

- **`bug-140`.** Without a TTY, `init` demands `--template`, but neither the error
  (`src/cli/init-command.ts:74`) nor the option's help (`src/cli/program.ts:120`) names the legal
  values.
- **`bug-129`.** On an initialised project, `init` says "use a migration command to change config"
  (`src/core/init.ts:54`), and no such command exists.

## Acceptance Criteria

1. The missing-argument error names the available templates, for example
   `missing required argument: --template (one of: Scrum, Kanban)`. The list is read from the
   template registry, not hard-coded, so a new template appears without editing the message.
   *Red-first.*
2. `init --help` names the same values in the `--template` description. *Red-first.*
3. The already-initialised error names what actually works: edit the files under `.wingfoil/`, or use
   the `dna` and `directive` commands, then commit. *Red-first.*
4. The exit codes are unchanged (the `spec-005` / REQ-INT-04 contract). *Characterization.*
5. `docs/cli-reference.md` matches, and `test/docs/cli-reference.test.ts` is green. `npm test` green.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
