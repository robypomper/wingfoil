---
id: dev-loop-rel-v0.3-plan
type: plan
title: "Dev-loop — rel-v0.3"
status: active
version: "1.2"
workflow: "dev-loop"
phase: "rel-v0.3"
element: "minor-v0.3"
release: "v0.3"
tmpl_version: 260703   # Orignal template version
---

## Context

`minor-v0.3` (`docs/04_memory/planning/rl-v1/minor-v0.3.md`, "WingFoil v0.3 - Project Workflow") is
`in-development` (`2bc3071e`). Its `release-planning` phase is `done`
(`release-planning-rel-v0.3-plan`, merged into `main` at `c00ef567` and pushed), with **121 backlog
tasks**, `task-126` … `task-246`, under `docs/04_memory/v0.3/`, grouped in four waves (Appendix E
of that plan: wave 0 → 4, 1 → 41, 2 → 23, 3 → 53). Per `release-cycle` the next phase is
`implementation`: one `dev-loop` run (`.wingfoil/workflows/custom/dev-loop.yaml` **v1.4**,
`element: task`) per task. The workflow engine does not exist yet, so this `plan` element is the
phase's execution scaffold (`dl-019`).

This is a **generic plan**, as in v0.1, v0.2 and v0.2.2: every run follows it, and the per-task
content and running log live in each task's own **Execution Notes**. No per-task plan file is
created. The plan is revised at each wave, when the next wave is opened.

**Preconditions (verified on `main` at `c00ef567`, 2026-09-30).**
- `minor-v0.3` `in-development`; `task-126` … `task-129` `backlog` (`grep -m1 '^status:'` on each
  file); their linked bugs `bug-087`, `bug-131`, `bug-155`, `bug-162`, `bug-171` `planned`.
- `main` equal to `origin/main` (`git fetch && git rev-list --left-right --count origin/main...main`
  → `0 0`).
- Design inputs in place: `spec-001`, `spec-003`, `spec-004`, `spec-005`, `spec-008`, `spec-010`,
  `spec-016`, `spec-017` `approved` (`grep -m1 '^status:'` on each file).
- The build in use is the pinned one (`dl-095`): `npm run -s wingfoil -- --version` → `0.2.2`, what
  `package-lock.json` pins for `wingfoil-released`. **Found stale at the start of this phase**: the
  main working tree's `node_modules` still held 0.2.1 (`--version` → `0.2.1`) after the pin advanced;
  `npm ci` fixed it. Each task worktree runs its own `npm ci`.
- Local toolchain: Node 22.21.0, npm 11.6.2 (`node -v`, `npm -v`).
- `memory add` of the pinned build allocates wrong ids on this repository (`bug-087`, `bug-162`).
  Named ids (`plan`) are safe: this plan was added with the pinned build (`f5b0dc2c`, checked: one
  commit, one file, the `{scope}` token resolved).

**Which build runs the Memory operations (approver, 2026-09-30).** Task sessions and every later
phase run the Memory verbs with the **code version**, not the pinned build: `npm run build`, then
`node dist/cli.js <command>` from the worktree in use, so that a command whose bug has been fixed
and merged into `main` is used as soon as it lands (e.g. `memory add` once `task-128` is merged).
This is session practice: `dl-095` and the pin are unchanged, and `npx wingfoil` is still not used.
Until `task-128` is on `main`, numbered elements (task, bug, decision-log, adr, tech-spec,
service) are still added **by hand**, at the highest number on every ref + 1 (`dl-101` §1). Every
command's real effect is checked (commit, diff, exit code).

**Produces.** The 121 tasks `backlog → done`, their linked bugs `planned → … → closed` through
`bug.sync_state` (§4), code and tests under `src/` and `test/` with coverage > 80% and not
regressing. Then `release-cycle` moves on to `user-docs`, which is not part of this plan.

## Phases / Steps

### 1. Per-task contract

Each task follows `dev-loop.yaml` v1.4, as detailed in `dev-loop-rel-v0.2-plan` §2–§3:

- **start** (developer): branch `task/{task.id}` cut from `main`, worktree `../.wf2-wt/task-{n}`,
  task `backlog → in-progress` (`wf(task): start {id} [backlog → in-progress]`, by hand: no verb),
  `bug.sync_state`.
- **design** (architect): classify each AC as red-first or characterization (T1; the planning
  already pre-classified them, the design phase confirms or corrects); read the Execution Notes of
  every `depends_on` task (`dl-015`, hard gate); verify the cited specs are `approved`; any spec
  change the task's ACs require is a Revision-noted edit inside the task (hand edit until
  `task-127`'s `memory amend` ships and the pin advances).
- **red / green / refactor** (developer): refactor's checks are coverage ≥ 80, `docs.api.*` and
  `lint.clean`, all hard-reject. `tsc --noEmit` is also run by hand (`dl-044`'s gate is declared by
  `task-173`).
- **review** (reviewer): unit and BDD suites green, `node dist/cli.js memory submit {id}` →
  `wf(task): submit {id}` (plain subject, no
  bracket, `dl-054`, confirmed at planning R20), `bug.sync_state`. **The loop stops here** until the
  approver rules.
- **done** (developer, on the approver's instruction only): `approve [in-review → approved]` with the
  code version (`node dist/cli.js memory approve`), `[approved → done]` by hand (`finalize`), both on the task branch; `git merge
  --no-ff` into `main`; worktree and branch removed; `bug.sync_state`.

Every task runs in its own worktree. The main working tree is shared with other sessions, so no
task commit is made there; before each commit the agent checks `git branch --show-current`. One
`npm test` per worktree at a time (concurrent runs corrupt `dist/`, `bug-095`). Commands take one
id per call (`bug-171`, until `task-129` lands).

### 2. Which v0.3 rules are in force

A ratified rule is in force from the approval of the task that implements it; no rule is brought
forward (reading of `release-planning-rel-v0.3-plan`, confirmed by the planning session on
2026-09-30):
- **`dl-133` stop-the-line** (Q3 30% open fix tasks, Q4 (i) block feature pick-up): threshold
  declared by `task-150` (wave 1), `start` check by `dev-loop.yaml` v1.6 (`task-221`). **Not in
  force in wave 0**: the 33% fix share today (40 of 121) is the planned composition of the backlog,
  not the in-release tail the rule measures. Tracked from wave 1 on, by hand, in each wave's revision
  of this plan.
- **`dl-134` separation of duties** (`red` by `qa`, independent executors): `dev-loop.yaml` v1.5,
  `task-205`. Until then the v1.4 roles apply.
- **`dl-100` §1 (a) governance re-sweep** and **`dl-133` §2 smoke + user-doc checks at each wave
  end**: declared as a wave-boundary phase by `task-230`. Not mandatory before it; at the end of wave
  0 the smoke (`node scripts/e2e-smoke.cjs`, `test/cli/e2e-smoke.test.ts`) and `docs/examples` are run anyway as a cheap check, and a
  failure is filed through `bug-ingest`.
- **`dl-102`**: ratified (a), rules in directives (`task-197`); no standing section in this plan.

### 3. Waves

The order follows Appendix E of `release-planning-rel-v0.3-plan` and the tasks' `depends_on`. Within
a wave, tasks run in parallel; a task may start as soon as its own `depends_on` are `done`.

**Wave 0** (opened 2026-09-30):

| Task | Kind | Bugs | Depends on | Starts |
|---|---|---|---|---|
| `task-126` closed `wf()` grammar (`dl-079`) | feature | `bug-155` | — | now |
| `task-128` id allocation (`dl-101`) | fix | `bug-087`, `bug-162` | — | now |
| `task-129` one operand per command (`dl-082`) | fix | `bug-131`, `bug-171` | — | now |
| `task-127` `memory amend` (`dl-108`) | feature | — | `task-126` | `task-126` `done` |

Shared files: `spec-008` §1/§2 (`task-126`, `task-127`, `task-129`) and `docs/cli-reference.md`
(`task-127`, `task-129`, gated by `test/docs/cli-reference.test.ts`). Merge order: `task-126` before
`task-129`, or `task-129` rebased on `main` before its merge; `task-127` is cut after `task-126` is
merged. `src/memory/add.ts` is `task-128`'s alone in this wave.

Wave-0 handovers from the planning session:
- `task-126` carries ruling R20/Q6: `element.set_release` is rebound to an already-declared verb (no
  `assign`), chosen in design; and the correction of `dl-079`'s approve-reason counts (`sync` 197,
  `finalize` 132 = 112 task + 20 plan, `start` 113).
- `submit` keeps no transition bracket (`dl-054` over `dl-106` W1 (a), R20).

**Waves 1–3**: opened by a revision of this plan when wave 0 closes.

### 4. `bug.sync_state` — linked bugs (wave 0)

| Task | `bug:` |
|---|---|
| `task-126` | `bug-155` |
| `task-128` | `bug-087`, `bug-162` |
| `task-129` | `bug-131`, `bug-171` |

Each bug has exactly one task, so the aggregate rule is 1:1. The bug's `status` changes in its own
commit, right after the task's transition and on the task branch:
`wf(bug): sync {bug.id} [{from} → {to}]`, as in v0.2.2.

## Handoff

- **Approver:** the review gate of every task and the `approve`/`reject` that follows it;
  confirmation of §2's reading (no v0.3 rule brought forward into wave 0); the rulings of each
  wave-boundary checkpoint; merges to `main` are the agent's after approval, pushes are the
  approver's call.
- **Agent:** start → review for each task in wave order, and the `done` mechanics (merge, worktree
  cleanup, bug sync) once the approver has ruled. It never approves.
- **Completion criteria:** the 121 tasks `done` and merged into `main`; their linked bugs `closed`;
  `npm test` green with coverage > 80%; this plan `active → done`. Next phase: `user-docs`.

## Execution Notes

- **2026-09-30 — wave 0 opened.** `task-126`, `task-128`, `task-129` started (branches and worktrees
  per §1); each ran design → submit through a developer agent and is `in-review`, its bugs synced
  `[in-progress → in-review]`. `task-127` waits for `task-126`'s merge.
- **2026-10-01 — independent review** of the three branches (a separate reviewer agent per task,
  read-only, before the approver's gate, as `task-125` did): all three "approve with fixes". Fixes
  inside each task are applied on its branch; the follow-ups become elements once `task-128` is
  merged, so that `memory add` (code version) allocates their ids.
- **2026-10-01 — approver ruling on `element.set_release`.** Raised by `task-126`'s review: binding
  it to `amend` (the reading of R20/Q6) collides with `dl-108` (approver-gated, `adr` not amendable)
  and with `build-backlog` (product-owner, no approval, stamps `adr` too). The approver **reverses
  `release-planning-rel-v0.3-plan` R20/Q6 on this point**: `assign` joins the closed verb list, needs
  no approver, and changes only `release`, on every type. Written into `spec-008` §2 and `spec-003`
  by `task-126`.
- Merge trial of the three branches on `main` (`6a28d281`): `task-126` and `task-128` merge clean;
  `task-129` conflicts on `spec-008`'s Revision notes only (both append), resolved by keeping both.
