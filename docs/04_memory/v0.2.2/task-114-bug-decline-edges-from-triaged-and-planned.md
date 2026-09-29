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

Branch `task/task-114-bug-decline-edges-from-triaged-and-planned`, worktree `../.wf2-wt/task-114`,
cut from `main` at `a15ab388`. Start: `24d56038` (task `[backlog → in-progress]`). `bug:` is empty,
so there is no `bug.sync_state`; `bug-092` closes by the approver's reject after the merge
(Implementation Notes).

### design (architect)

**`depends_on` read (dl-015).** `task-111` is `done`
(`grep -m1 '^status:' docs/04_memory/v0.2.2/task-111-configuration-moves-to-the-repository-root.md`
→ `status: done`). What this task takes from its Execution Notes:
- The configuration is `.wingfoil/memory.yaml` at the repository root, so the CLI run from a clone's
  root reads this repository's own machine: the e2e below runs `memory reject`/`approve` on a
  throwaway clone, as `task-111`'s scratch-clone probe did, never on the real Memory.
- Standing note 6 (`test/cli/own-memory.integration.test.ts` reads the real history of `bug-077`):
  this task rewrites no history and moves no bug, so it does not apply; the new test reads the
  configuration at `HEAD` only.
- Ruling item 7 (no `version` bump for path-only edits): this task changes values in `memory.yaml`,
  so its `version` is bumped (AC 1); the stale descriptions below are wording, not paths, and are
  bumped where the document carries a version (`doc-versioning`).

Also read, because it edited the same file last: `task-123`'s Execution Notes (`done`). It bumped
`memory.yaml` `1.3 → 1.4` in `0bd69282` (`git log --format='%h %s' -1 -- .wingfoil/memory.yaml`),
so this task takes it `1.4 → 1.5`. Its `test/core/memory-add-scaffold-paths.test.ts` resolves every
type's scaffold from the `memory.yaml` committed at `HEAD`; this change touches no `template.file`,
and the test is re-run after the green commit (below).

**Governing decision and spec.** `dl-123` is `ready` (`grep -m1 '^status:'` → `status: ready`),
ratified (A)(i) in `34fb30c9` ("(A) add triaged and planned reject edges to closed in the bug
machine's gates, (i)"). `spec-001-memory-yaml-schema` is `approved`; its *Revision (2026-09-29)*
already lists "`bug`: `triaged` and `planned` gain `reject: closed`", its worked `bug` example
carries both edges, and its *Which verb drives each forward edge* rules allow a state that is both a
`gates` key and `waiting` ("its forward edge is verb-less ... while it still exposes a manual
`reject`/decline path"). No spec is missing; the one sentence the change makes stale is the worked
examples' caveat "until then the file has no ... `triaged`/`planned` reject edges", fixed below.

**Engine, measured at `a15ab388`** (`node -e` over `dist/memory/state-machine.js`, calling
`resolveTypeTransition(<HEAD memory.yaml>, 'bug', s, op)`):

| from | `reject` | `approve` | `submit` |
|---|---|---|---|
| `open` | `closed` | `triaged` | illegal (a `gates` state) |
| `triaged` | illegal: not a `gates` state ("`reject` is only legal from a gate") | illegal: not a `gates` state | illegal: a `waiting` state |
| `planned` | illegal: not a `gates` state | illegal: not a `gates` state | illegal: a `waiting` state |

`resolveTransitionTarget` already returns `gate.reject` for any gated state and refuses `approve`
from a state that is both gated and `waiting` ("both a `gates` and `waiting` state — its forward
edge is verb-less"), so the change is configuration only: no `src/` edit.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — two `gates` edges, `[AUTHORING]` `dl-123`, `version` bumped | configuration | the green change; proven by AC 2 |
| 2 — `reject` from `triaged`/`planned` → `closed` + `rejection_reason`; `approve` still illegal because both are `waiting` | **red-first** | `reject` from both is illegal today (table above). `approve` is illegal today too, but for another reason ("not a `gates` state"); the assertion pins the reason the AC names, which appears only once the states are gated |
| 3 — every other edge unchanged | characterization | the full bug edge table passes on first run for every other cell |
| 4 — `npm test` green | verification | gates below |

**Consequence for an existing test.** `test/memory/state-machine.test.ts`, the `dl-053` case
"`bug` has three approve gates — from `triaged` ...", asserts the message
`illegal transition triaged -> resolved for type 'bug'` (unchanged after the edit: `contractTarget`
skips `open`'s `approve`, whose target is `triaged` itself, and `triaged`/`planned` refuse `approve`)
and a detail matching "not a `gates` state", which becomes "both a `gates` and `waiting` state".
Its detail assertion changes with the configuration; the message is kept.

**Baseline** (this worktree at `24d56038`, before any change):
`npx jest --coverage --coverageReporters=text-summary --coverageReporters=json-summary` →
154 suites / 2491 tests passed; stmts 98.62 (3874/3928), branches 94.18 (1993/2116),
funcs 93.79 (650/693), lines 99.47 (3398/3416).

### red (developer)

### green (developer)

### refactor (developer)

### review (reviewer)
