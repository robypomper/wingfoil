---
id: "task-114-bug-decline-edges-from-triaged-and-planned"
type: task
title: "A bug ruled not-to-be-fixed after triage has an approver-gated exit to `closed`"
status: in-review
release: "v0.2.2"
priority: "medium"
tags: ["v0.2.2", "memory", "config", "bug-machine"]
ref: "dl-123-a-bug-ruled-wontfix-has-a-legal-exit"
bug: []
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`, dl-123). A single string is still accepted for documents predating dl-045.
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

### red (developer) — `5209b4b3`

`test/core/bug-decline-edges.test.ts`, 13 tests, all on this repository's `.wingfoil/memory.yaml` as
committed at `HEAD` (`readPathAtRev` / `loadMemoryYamlAtHead`, never the working tree, never a copy of
the machine written into the test):
- AC 2, through the real `CORE_MODULES` operations in a throwaway git repository whose
  `.wingfoil/memory.yaml` is the committed file byte for byte: `memoryReject` on a `triaged` and on a
  `planned` bug → `closed`, `rejection_reason` set, one commit
  `wf(bug): reject <id> [<state> → closed]` with the `Approver:`/`Reason:` body, touching only the
  bug file; `memoryApprove` on both → `INVALID_TRANSITION`, detail "both a `gates` and `waiting`
  state", file and `HEAD` unchanged.
- AC 2 + AC 3, the full bug edge table: for each of the 8 `sequence` states, the target of
  `submit`/`approve`/`reject` (or illegal) and `deprecate` → `deprecated`; plus `sequence` and
  `waiting: [triaged, planned]` pinned.

`npx jest test/core/bug-decline-edges.test.ts` → **6 failed, 7 passed**. The 6: the two rejects
(`result.ok` false), the two approves (detail received: "not a `gates` state — `approve` is only
legal from a gate"), and the edge-table rows for `triaged` and `planned` (`"reject": null`, expected
`"closed"`). The 7 that pass on first run are the characterization rows of AC 3 (the other six
states, and the `sequence`/`waiting` check). `npx eslint test/core/bug-decline-edges.test.ts` → exit 0.

### green (developer) — `f0ba189a`

`.wingfoil/memory.yaml`: `bug.states.gates` gains `triaged: { reject: closed }` and
`planned: { reject: closed }`, each annotated `[AUTHORING] dl-123 (A)`; the `waiting` comment says
both are now also gated; `version: 1.4 → 1.5`. No `src/` change (`git show --stat f0ba189a` →
`.wingfoil/memory.yaml` and `test/memory/state-machine.test.ts` only).

The existing `dl-053` case in `test/memory/state-machine.test.ts` failed on the edit, as foreseen in
design (`npx jest test/memory/state-machine.test.ts` → 1 failed: expected /not a `gates` state/,
received "both a `gates` and `waiting` state — its forward edge is verb-less ..."). Its detail
pattern was updated in the same commit, with a comment; its message
`illegal transition triaged -> resolved for type 'bug'` is kept and still passes.

After the commit (the new test reads `HEAD`):
`npx jest test/core/bug-decline-edges.test.ts test/memory/state-machine.test.ts test/core/memory-add-scaffold-paths.test.ts`
→ 3 suites, 95 tests passed. `task-123`'s scaffold test stays green: no `template.file` changed.

### refactor (developer)

No code to refactor. The pass fixed the prose that described the bug machine as it was
(`4ce1fc5d`, `ac317287`, `2e04b587`; found with
`git grep -n -iE "only reject edge|reject edge to .?closed|wontfix|open → closed|reject: closed|can never leave .triaged|no legal (exit|path)"`
and a grep for `triaged` over `CLAUDE.md`, `README.md`, `docs/`, `.wingfoil/`, `src/`):

| Document | What was stale | Version |
|---|---|---|
| `.wingfoil/workflows/custom/dev-loop.yaml`, header comment | "a bug that no task names here can never leave `triaged` ... the only reject edge to `closed` starts from `open`" | `1.3 → 1.4`, changelog says comment-only |
| `.wingfoil/memory/templates/task.md`, `bug:` comment | "a bug with no task naming it here can never leave `triaged`" | none (`tmpl_version` is the scaffold stamp, not a doc version; left at `260703`) |
| `.wingfoil/WORKFLOW.md`, Bug state diagram | no `triaged --> closed` / `planned --> closed` edge | no version field |
| `CLAUDE.md` §5 table, `bug` row | `triaged→planned` with no reject edges | no version field |
| `CLAUDE.md` §5.1 `memory.reject` step 1 | "`open → closed` or `in-review/resolved → in-progress` for `bug`" | — |
| `spec-001-memory-yaml-schema`, worked-examples caveat (twice) | "until then the file has no ... `triaged`/`planned` reject edges" | tech-specs carry no `version:` (`dl-047`); the Revision's `dl-123` bullet records the landing |
| `dev-loop-rel-v0.2-plan` §2 (`bug.sync_state`) | same sentence as `dev-loop.yaml`; the v0.2.2 plan §1 cites this section as the live contract | `"1.2" → "1.3"`, rewritten as "in v0.2 ... since v0.2.2" |
| `dev-loop-rel-v0.2.2-plan` Context | "because `dev-loop.yaml` is still v1.3" — made false by this task's bump | `"1.3" → "1.4"` (bumped to 1.3 on `main` by `task-112`) |
| this task's own frontmatter `bug:` comment | copied from the template at scaffold time | — |

Kept as written, on purpose (records of their time, not descriptions of today's machine):
`release-submit-rel-v0.2-plan` ("`deprecate` is the only legal way to retire a bug once it is past
`triaged`" — the v0.2 gate's rationale, plan `done`), `retrospective-rel-v0.2-plan` (the
analysis that produced `dl-123`), `docs/04_memory/v0.2/task-076-…` Execution Notes,
`docs/04_memory/planning/rl-v1.md` (about another branch's machine), `dl-123` and `bug-094`
themselves, and the `bug:` frontmatter comment copied into the other v0.2.2 task files (`task-110`,
`112`, `115`, `116`, `121`, `123`: other tasks' documents). Not stale:
`release-planning.yaml` `triage-bugs` fallback (`open -> closed`, the edge that step uses), the bug
template's "wontfix/duplicate rationale if rejected to `closed`".

**AC 2/3 end to end, on a throwaway clone** (`git clone --branch task/task-114-… <worktree>
$(mktemp -d <session scratchpad>/e2e-114-XXXX)/wf` at `ac317287`; `wingfoil` =
`node <worktree>/dist/cli.js` after `npm run build`; the clone's git identity is the approver's, as
in the real repository; the clone was deleted afterwards and nothing reached this repository):

| command | output | commit / file |
|---|---|---|
| `memory reject bug-012-mcp-latency-single-sample --reason "probe"` (`triaged`) | `{"from":"triaged","to":"closed","reason":"probe",…}` exit 0 | `wf(bug): reject bug-012-mcp-latency-single-sample [triaged → closed]` / `Approver: Roberto Pompermaier <robypomper@gmail.com> (approver)` / `Reason: probe`; only the bug file; `status: closed`, `rejection_reason: probe` |
| `memory reject bug-128-subcommand-help-describes-no-command-and-no-argument --reason "probe"` (`planned`) | `{"from":"planned","to":"closed",…}` exit 0 | `wf(bug): reject bug-128-… [planned → closed]`, same body; only the bug file; `status: closed`, `rejection_reason: probe` |
| `memory approve bug-133-e2e-smoke-never-revalidates-what-a-command-wrote --reason "probe"` (`triaged`) | `error: illegal transition triaged -> resolved for type 'bug'` exit 1 | none, `HEAD` unchanged, `git status --porcelain` empty |
| `memory approve bug-139-dna-scaffold-hides-required-category --reason "probe"` (`planned` in that clone) | `error: illegal transition planned -> triaged for type 'bug'` exit 1 | none, `HEAD` unchanged |

Control, a second clone checked out at `5209b4b3` (red, before the edit): the same two rejects →
`error: illegal transition triaged -> closed for type 'bug'` and `… planned -> closed …`, exit 1.

**Gates** (worktree, after merging `main`, below):

| Check | Command | Result |
|---|---|---|
| unit + BDD | `npx jest --coverage --coverageReporters=text-summary --coverageReporters=json-summary` | 156 suites / 2549 tests passed |
| baseline | same command on `main` at `3227aefb` (detached temporary worktree, removed after) | 155 suites / 2535 tests passed |
| coverage before → after | same | stmts 98.62 (3874/3928) → 98.62 (3874/3928); branches 94.18 (1993/2116) → 94.18; funcs 93.79 (650/693) → 93.79; lines 99.47 (3398/3416) → 99.47 — no `src/` change |
| `lint.clean` | `npm run lint` | exit 0 |
| `docs.api.*` | `npm run docs:api` | exit 0 |
| types | `npx tsc --noEmit` | exit 0 |

+14 tests: the 13 new ones, and one more `it.each` row in
`test/core/latency-budget-placement.test.ts`, which scans every test file
(`npx jest test/core/latency-budget-placement.test.ts` → 159 on `3227aefb`, 160 here).

### review (reviewer)

- **Acceptance (P1.7 approve, P1.8 reject, P1.13 machines):**
  `npx jest $( (grep -rlE "P1\.8|P1\.7|P1\.13" test; echo test/core/bug-decline-edges.test.ts test/core/memory-add-scaffold-paths.test.ts test/memory/state-machine.test.ts) | tr ' ' '\n' | sort -u)`
  → 18 suites, 333 tests passed.
- **`main` moved during the task** (`git log --oneline a15ab388..main` → to `3227aefb`: `task-112`,
  `task-113`, `task-118` merged, `bug-164` filed, a bug-ingest plan). Merged with
  `git merge --no-ff main` (`476eac22`, no rebase, no conflict); `npm ci` after it (`task-112`
  added the `wingfoil-released` devDependency). None of the merged commits touched
  `.wingfoil/memory.yaml` (`git diff --stat a15ab388 main -- .wingfoil/memory.yaml` → nothing).
  The gates table ran after the merge; the stale-prose sweep was re-run over the merged content and
  found only the v0.2.2 plan's version sentence (fixed, `2e04b587`).
- **`main` moved again before submit** (to `f0c87536`: `bug-159…164` `open → triaged`, `task-124`
  (`dl-088`) filed to `backlog`, the v0.2.2 plan at `1.4`). Merged the same way (`d9f7d81d`, no
  conflict: git took the identical `version: "1.4"` line from both sides). Both sides had bumped the
  plan `1.3 → 1.4` for different edits, so it goes to `1.5` (`f1c0f27d`). No merged commit touches
  `.wingfoil/`, `src/` or `test/` (`git diff --stat 569a0c31 d9f7d81d` → Memory files and the plan
  only). Re-run: `npx jest` → 156 suites / 2549 tests passed.
- **For the approver.**
  1. `bug-092` (`triaged`) can now close by `wf(bug): reject bug-092-… [triaged → closed]` once this
     merges — the e2e above is that command on a clone.
  2. `dev-loop.yaml` was bumped `1.3 → 1.4` for a comment-only correction, under `doc-versioning`;
     task-111's ruling item 7 waived the bump for *path* corrections only. If a comment fix should not
     bump a workflow's version, revert the bump and the v0.2.2 plan sentence with it.
  3. Two done plans keep present-tense sentences about the old machine as records
     (`release-submit-rel-v0.2-plan`, `retrospective-rel-v0.2-plan`, table above); the other v0.2.2
     task files keep the old template comment in their frontmatter. Say if either should be edited.
  4. Observation, unchanged by this task: `memory approve` on a `planned` bug prints
     `illegal transition planned -> triaged` — `dl-053`'s canonical `approve` edge (`open → triaged`)
     reads like a backward move from `planned`. Measured identically before the edit (design table:
     `planned approve => illegal transition planned -> triaged`). No element covers it
     (`git grep -n "planned -> triaged" -- docs/04_memory/bugs docs/04_memory/design` → nothing);
     filing it is the approver's call.
