---
id: "task-010-default-state-machine-fallback"
type: task
title: "Infrastructure: REQ-STATE-08 — Default state-machine fallback"
status: backlog
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-STATE-08"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-STATE-08 requires that a Memory `type` declared **without its own `states` block** in
`memory.yaml` falls back to a shared `defaults.states` machine, reducing config friction for simple
types that don't need a custom lifecycle. This task implements that fallback resolution in the
state-machine validator: when a `types.<name>` entry has no `states:` key, the validator must resolve
`defaults.states` for that type instead of erroring or silently allowing any transition.

Per `spec-001-memory-yaml-schema` (`docs/self/.wingfoil/memory.yaml` lines 61-65), the current default
machine is encoded as:

```yaml
defaults:
  states:
    sequence: [ draft, pending, approved ]
    gates:
      pending: { reject: draft }
```

i.e. `draft → pending` (via `memory.submit`), then `pending`'s forward edge to `approved` is an
approval gate (`memory.approve`) whose `reject` target is `draft` directly — there is no separate
`rejected` status recorded on disk (the rejection reason lives in the git commit body per P1.7). Note
that REQ-STATE-08's own literal wording, "`draft → pending → approved/rejected → deprecated`", describes
the **old** `transitions` dict-of-arrays encoding; spec-001 explicitly flags this as needing
reconciliation — the requirement's *intent* (a usable default for types with no custom lifecycle)
still holds, but its literal transition list is superseded by the `sequence`/`gates` shape above.
Today all seven declared types (`release-line, release, task, adr, decision-log, tech-spec, bug`)
define their own `states:` block, so the fallback path currently has **no live consumer** — it must be
exercised by a dedicated fixture/test type in the validator's test suite, not by any real Memory type.

## Acceptance Criteria

Per the SARD fit criterion (`docs/02_requirements/03_sard/03_state-context.md`, REQ-STATE-08):

> A type defined without a `states` block accepts exactly the default transitions and rejects any
> transition outside them.

Testable form:
- A fixture type added to `memory.yaml` with no `states:` key resolves to `defaults.states`
  (`sequence: [draft, pending, approved]`, `gates: { pending: { reject: draft } }`) and:
  - `memory.add` sets `status: draft` (chain head).
  - `memory.submit` moves `draft → pending`.
  - `memory.approve` moves `pending → approved`; `memory.reject` moves `pending → draft` (no
    `rejected` status is ever written).
  - Any other transition (e.g. `draft → approved` directly) is rejected and leaves `status` unchanged.
- Removing the type's `states:` block from `memory.yaml` (if it had one) and reloading falls back to
  `defaults.states` with no code change (ties to REQ-SYS-04).

## Implementation Notes

- `spec-001-memory-yaml-schema` is the authoritative source both for the `defaults.states` shape
  (`z.object({ states: StateMachine }).optional()` at the `MemoryYaml` top level) and for the
  reconciliation note above; it also documents that `types.<name>.states` is `.optional()` — "absent ⇒
  `defaults.states` applies (REQ-STATE-08)".
- `spec-009-validation-strategy`'s two-pass pipeline is where the fallback resolution belongs: Pass 1
  (structural) validates whichever `StateMachine` block ends up in play (declared or default); Pass 2
  (semantic) enforces the resolved machine's `sequence`/`gates`/`waiting` against the requested
  transition.
- Since no current type in `docs/self/.wingfoil/memory.yaml` actually omits `states:`, verification for
  this task should add a throwaway fixture type in the test suite (not a change to the real
  `memory.yaml`) to exercise the fallback path end-to-end.
- Related feature work in this release that this infra task unblocks (`related_stories` in
  `docs/03_backlog/04_backlog/by-release/v0.1.json`, backlog `TASK-008`): `TASK-022` "Implement Memory
  Element Schema (memory.yaml)" (memory `task-024-implement-memory-element-schema.md`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
