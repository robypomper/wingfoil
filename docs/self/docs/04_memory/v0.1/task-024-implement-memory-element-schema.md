---
id: "task-024-implement-memory-element-schema"
type: task
title: "Implement Memory Element Schema (memory.yaml) (P1.13)"
status: pending
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "memory"]
ref: "P1.13"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Feature **P1.13 — Memory Element Schema (`memory.yaml`)**: define each Memory element type — path
pattern, name, description, tags, and allowed states + transitions — in `.wingfoil/memory.yaml`,
forming the basis for every type's per-type state machine.

As Morgan (US-0A-04), I want to define Memory element types (pattern paths, allowed states, and
transitions) in `.wingfoil/memory.yaml` so per-type state machines are enforced.

Concretely this task implements the `memory.yaml` schema engine: parse and validate the `types.*`
map (each type's `path`, `id_pattern`, `template`, and state machine, encoded as `sequence` +
`gates` + `waiting` per the current schema — see CLAUDE.md §5), fall back to the shared default
machine (`draft → pending(→draft) → approved/rejected → deprecated`) for any type that declares no
explicit `states` block, and reject malformed schemas — e.g. a transition target that references a
state not declared in that type's `values`/`sequence` — before any document of that type can be
created or transitioned.

## Acceptance Criteria

See docs/02_requirements/02_bdd/features/p1-memory/P1.13-memory-element-schema.feature. Key
scenarios:
- **Validate a well-formed element schema**: given `.wingfoil/memory.yaml` defines type `release`
  with states and transitions, validation passes and the `release` type exposes initial state
  `draft`.
- **A type with no explicit states uses the defaults block**: a type like `note` with no `states`
  block falls back to the default machine
  `draft -> pending -> approved/rejected -> deprecated`.
- **Error — a transition references an undeclared state**: if type `release` lists a transition
  target `shipped` not present in its declared states, validation fails with message "transition
  target 'shipped' not in declared states for type 'release'".

## Implementation Notes

Cross-references `spec-001-memory-yaml-schema` (the authoritative schema this task implements:
`sequence`/`gates`/`waiting` state-machine encoding, type registry shape) and
`spec-010-memory-frontmatter-schema` (the per-document frontmatter contract this schema's
`status` field validates against, realizing REQ-STATE-01 — every transition validated against the
type's declared machine — and REQ-SYS-03 — state derived from frontmatter, no separate state
index). This schema engine underpins every other Memory command (`add`, `submit`, `approve`,
`reject`, `deprecate`, `search`, `history`) implemented by task-020/task-021/task-022/task-023 and
later releases. Depends on task-001 (Node.js/TypeScript scaffold) and task-002 (validation/ID
engine), whose ID/type validation this schema engine drives.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
