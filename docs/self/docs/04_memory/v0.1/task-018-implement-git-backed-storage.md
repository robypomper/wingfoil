---
id: "task-018-implement-git-backed-storage"
type: task
title: "Implement Git-Backed Storage (P1.1)"
status: in-progress
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "memory"]
ref: "P1.1"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Feature **P1.1 — Git-Backed Storage (foundational)**: a centralized git repository holding all
project state (Memory, DNA, Directives, Workflow) under `.wingfoil/`. This is the storage
foundation every other pillar depends on.

As Alex (US-0A-01), I want all project state stored in a centralized git repository under
`.wingfoil/` so I have a single, versioned source of truth from day one.

Concretely this task implements the `.wingfoil/` init routine: detect whether the target
directory is a git repository; if not, fail fast without creating any files; if so, create
`.wingfoil/` with the `memory/` and `directives/` subfolders and the `dna.yaml`, `memory.yaml`,
`workflows.yaml` files, and stage all of them as a single git commit authored by the current git
user. It also establishes the invariant that any subsequent write by any pillar under `.wingfoil/`
is tracked by git with no untracked residue.

## Acceptance Criteria

See docs/02_requirements/02_bdd/features/p1-memory/P1.1-git-backed-storage.feature. Key scenarios:
- **Initialize the WingFoil storage structure**: given no `.wingfoil/` folder, initializing
  creates it with `memory/`, `directives/`, `dna.yaml`, `memory.yaml`, `workflows.yaml`, and the
  new files are staged as a single git commit authored by the current git user.
- **Persisting a pillar state file produces exactly one tracked change**: once initialized, any
  pillar writing a state file under `.wingfoil/` results in that file being tracked by git with
  `git status` reporting no untracked residue.
- **Error — target directory is not a git repository**: initialization stops without creating
  `.wingfoil/` and exits with code 1 and message "not a git repository: run 'git init' first".

## Implementation Notes

Implements the storage layout defined in `spec-011-storage-layout` (`.wingfoil/` directory shape,
init-detection rules, `built-in/` vs `custom/` split) and is the concrete realization of
REQ-SYS-01 (git-backed single source of truth) and REQ-SYS-02 (decoupled pillars as independently
loadable artifacts). Depends on task-001 (Node.js/TypeScript scaffold) for the project skeleton
and task-002 (validation/ID engine) for the schema/ID validation used once files begin being
written into this structure.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
