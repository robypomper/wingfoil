---
id: "task-005-per-type-state-machines"
type: task
title: "Infrastructure: REQ-SYS-04 — Configurable per-type state machines"
status: backlog
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SYS-04"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-SYS-04 requires that Memory element types and their state machines be **declared in
`.wingfoil/memory.yaml`**, not hardcoded in source. Different element types (`task`, `release`, `adr`,
`decision-log`, `tech-spec`, `bug`, `release-line`) have different lifecycles, and adding a new type
with a custom set of states must be honored by `submit`/`approve`/`reject` with zero source-code change.

Concretely, this task implements the state-machine validator against the `sequence` / `gates` /
`waiting` encoding defined by `spec-001-memory-yaml-schema`: `sequence` is the ordered forward chain
(its first element is the type's initial state, replacing the old explicit `initial:` field), `gates`
marks which forward edges are approval gates (and what `reject` targets), and `waiting` marks states
whose forward edge fires only via a Workflow action, never a CLI verb. The validator reads this purely
from `memory.yaml` — it needs no Workflow-step context to know which edge `approve`/`reject` take
(spec-001 fixed this ambiguity that the old `transitions: {state: [target,...]}` dict-of-arrays shape
left unresolved).

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/01_architecture.md`, REQ-SYS-04):

> Adding a new type with custom states to `memory.yaml` is honored by `submit`/`approve`/`reject` with
> no source-code change; an illegal transition for that type is rejected.

Testable form:
- Adding a new `types.<name>.states` block (its own `sequence`/`gates`/`waiting`) to `memory.yaml`
  makes `memory.add/submit/approve/reject` for that type work immediately, with no code deployed.
- Attempting a transition not on the type's `sequence` chain (or not matching a declared `gates`
  target) is rejected before any file is written and the document's `status` is left unchanged
  (REQ-STATE-01).

## Implementation Notes

- `spec-001-memory-yaml-schema` is the authoritative schema for the `sequence`/`gates`/`waiting`
  encoding this validator consumes — it replaced the ambiguous `transitions` dict-of-arrays precisely
  so state could be validated from `memory.yaml` alone (see spec-001 "Consequences").
- `spec-009-validation-strategy`'s two-pass pipeline (structural Zod pass, then semantic pass) is where
  this state-machine validation slots in as part of Pass 2 for Memory frontmatter mutations.
- Related feature work in this release that this infra task unblocks (`related_stories` in
  `docs/03_backlog/04_backlog/by-release/v0.1.json`, backlog `TASK-003`): `TASK-022` "Implement Memory
  Element Schema (memory.yaml)" (memory `task-024-implement-memory-element-schema.md`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
