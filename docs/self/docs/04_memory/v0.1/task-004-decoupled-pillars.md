---
id: "task-004-decoupled-pillars"
type: task
title: "Infrastructure: REQ-SYS-02 — Decoupled pillars as independent artifacts"
status: in-progress
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SYS-02"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-SYS-02 requires that WingFoil's four pillars be separate, independently loadable config artifacts:
`.wingfoil/memory.yaml` (Memory), `.wingfoil/dna.yaml` (DNA), `.wingfoil/directives/` (Directives), and
`.wingfoil/workflows.yaml` (Workflow). Editing one artifact and reloading must not raise errors in, or
otherwise require touching, any of the other three — each pillar owns its own schema and its own
validation pass.

This task builds the loader boundary that keeps that decoupling real rather than accidental: each
pillar gets its own Zod schema (`spec-001` for `memory.yaml`, `spec-002` for `dna.yaml`, `spec-003` for
`workflows.yaml`) validated independently through the shared two-pass pipeline (`spec-009`), and the
`core` module (`src/core`) exposes one loader per pillar so that, e.g., adding a new Memory `type` never
requires a change to `dna.yaml` or `workflows.yaml`, and vice versa. It also covers the automated
cross-pillar load test: load all four pillars, mutate one file, reload all four, and assert the other
three are unaffected.

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/01_architecture.md`, REQ-SYS-02):

> Each pillar artifact passes its own schema validation in isolation; editing one artifact and reloading
> does not raise errors in the others (automated cross-pillar load test).

Testable form:
- `memory.yaml`, `dna.yaml`, `directives/*.yaml`, and `workflows.yaml` each validate against their own
  Zod schema independently, with no cross-file schema dependency.
- An automated test that edits `memory.yaml` (e.g. adds a new `type` entry) and reloads all four
  pillars reports zero validation errors in `dna.yaml`, `directives/`, or `workflows.yaml`.

## Implementation Notes

- `spec-001-memory-yaml-schema`, `spec-002-dna-yaml-schema`, and `spec-003-workflows-yaml-schema` are
  the three independent per-pillar schemas this task must keep decoupled.
- `spec-009-validation-strategy` defines the shared two-pass (structural Zod + semantic) pipeline that
  all three schemas run through — the pipeline is shared code, but each pass is still per-artifact and
  failure in one pillar's Pass 1/2 must not block the others' loaders.
- `spec-011-storage-layout` documents the directory separation (`.wingfoil/memory.yaml` vs `dna.yaml`
  vs `directives/` vs `workflows.yaml`) this decoupling is built on.
- Related feature work in this release that this infra task unblocks (`related_stories` in
  `docs/03_backlog/04_backlog/by-release/v0.1.json`, backlog `TASK-002`): `TASK-022` "Implement Memory
  Element Schema (memory.yaml)" (memory `task-024-implement-memory-element-schema.md`) and `TASK-025`
  "Implement Project DNA (structured config)" (memory `task-027-implement-project-dna.md`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
