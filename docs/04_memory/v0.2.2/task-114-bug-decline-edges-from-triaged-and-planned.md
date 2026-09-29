---
id: "task-114-bug-decline-edges-from-triaged-and-planned"
type: task
title: "A bug ruled not-to-be-fixed after triage has an approver-gated exit to `closed`"
status: in-progress
release: "v0.2.2"
priority: "medium"
tags: ["v0.2.2", "memory", "config", "bug-machine"]
ref: "dl-123-a-bug-ruled-wontfix-has-a-legal-exit"
bug: []
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-111-configuration-moves-to-the-repository-root"]
tmpl_version: 260703
---

## Description

`dl-123`, ratified as (A)(i), gives the bug machine a legal wontfix exit after triage. It adds
`triaged: { reject: closed }` and `planned: { reject: closed }` to `memory.yaml`'s `bug.gates`. This
is a configuration change only. The engine already accepts a state that is both `waiting` and gated
(`src/memory/state-machine.ts`, `spec-001` as amended `0f68c739`), and the release gate needs no
change. Scheduled into v0.2.2 so that `bug-092` can close there (retrospective row 27).

## Acceptance Criteria

1. `memory.yaml`'s `bug.gates` gains the two edges, each annotated `[AUTHORING]` with `dl-123`, and
   the file's `version` is bumped (`doc-versioning`).
2. The two new edges are pinned by a test. On the real configuration, `reject` from `triaged` and
   from `planned` lands on `closed` and sets `rejection_reason`. `approve` from either state is still
   illegal, because both are `waiting`. *Red-first.*
3. Every edge the machine already had is unchanged, pinned by the existing tests or new ones.
   *Characterization.*
4. `npm test` green.

## Implementation Notes

- Closing `bug-092` is the approver's
  `wf(bug): reject … [triaged → closed]` **after** this task merges. It is not part of this task.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
