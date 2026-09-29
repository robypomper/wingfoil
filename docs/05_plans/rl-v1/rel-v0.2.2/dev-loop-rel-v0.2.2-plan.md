---
id: "dev-loop-rel-v0.2.2-plan"
type: plan
title: "Dev-loop — rel-v0.2.2"
status: active
version: "1.0"
workflow: "dev-loop"
phase: "rel-v0.2.2"
element: "patch-v0.2.2"
release: "v0.2.2"
tmpl_version: 260703
---

## Context

`patch-v0.2.2` (`docs/self/docs/04_memory/planning/rl-v1/patch-v0.2.2.md`) is `in-development`
(`16e12769`). Its `release-planning` phase is `done` (`release-planning-rel-v0.2.2-plan`, merged into
`main` at `4770a52c`), with **14 backlog tasks**, `task-109` … `task-122`, under
`docs/self/docs/04_memory/v0.2.2/`. Per `release-cycle` the next phase is `implementation`: one
`dev-loop` run (`.wingfoil/workflows/custom/dev-loop.yaml` **v1.3**, `element: task`) per task. The
workflow engine does not exist yet, so this `plan` element is the phase's execution scaffold
(`dl-019`).

This is a **generic plan**, as in v0.1 and v0.2: every run follows it, and the per-task content and
running log live in each task's own **Execution Notes**. No per-task plan file is created. The
phase-by-phase contract is the one of `dev-loop-rel-v0.2-plan` §3, unchanged, because `dev-loop.yaml`
is still v1.3. What is specific to v0.2.2 is the wave order (§2) and the configuration move in the
middle of it (§3).

**Preconditions (verified on `main` at `4770a52c`, 2026-09-29).**
- `patch-v0.2.2` `in-development`; the 14 tasks `backlog` (`grep -m1 '^status:'` on each file).
- `main` equal to `origin/main` (`git rev-list --left-right --count origin/main...main` → `0 0`).
- Design inputs in place: `adr-011` `accepted` (`cdf286d4`); `spec-001`, `spec-010`, `spec-015`
  amended and `approved` (`0f68c739`, `289300a5`, `0a4f7a9c`, fixed `33d89b7c`).
- The Memory verbs cannot be pointed at this repository (`bug-075`, `open`), so every Memory
  operation is done by hand in the `wf({type}): {verb} {ids}` format until `task-111` lands (§3).
- Local toolchain: Node 22.21.0, npm 11.6.2 (`node -v`, `npm -v`). `act` is not installed
  (`which act` → nothing), which bounds `task-113` AC 8.

**Produces.** The 14 tasks `backlog → done`; their linked bugs `planned → … → closed` through
`bug.sync_state` (§4); code and tests under `src/` and `test/` with coverage > 80% and not
regressing. Then `release-cycle` moves on to `user-docs`, which is not part of this plan.

## Phases / Steps

### 1. Per-task contract

Each task follows `dev-loop.yaml` v1.3, as detailed in `dev-loop-rel-v0.2-plan` §2–§3:

- **start** (developer): branch `task/{task.id}` cut from `main`, worktree
  `../.wf2-wt/task-{n}`, task `backlog → in-progress`, `bug.sync_state`.
- **design** (architect): classify each AC as red-first or characterization (T1); read the Execution
  Notes of every `depends_on` task (`dl-015`, hard gate); verify the cited specs are `approved`.
- **red / green / refactor** (developer): refactor's checks are coverage ≥ 80, `docs.api.*` and
  `lint.clean`, all hard-reject.
- **review** (reviewer): unit and BDD suites green, `wf(task): submit {id}` (plain subject, no
  bracket, `dl-054`), `bug.sync_state`. **The loop stops here** until the approver rules.
- **done** (developer, on the approver's instruction only): `approve [in-review → approved]` and
  `[approved → done]` on the task branch, `git merge --no-ff` into `main`, worktree and branch
  removed, `bug.sync_state`.

Every task runs in its own worktree. The main working tree is shared with other sessions, so no
task commit is made there. Before each commit the agent checks `git branch --show-current`.

### 2. Waves (the approver's choice, 2026-09-29)

The order follows `retrospective-rel-v0.2-plan` §6.8 and the tasks' `depends_on`. It also follows
the files the tasks share, so that two open tasks never rewrite the same file:

| Shared file | Tasks |
|---|---|
| everything under `docs/self/` (moved by `git mv`) | `task-111` against all the others |
| `package.json` / `package-lock.json` | `task-112`, `task-115`, `task-116`, `task-117` (112 and 117 both regenerate the lock) |
| `docs/cli-reference.md` | `task-110`, `task-119`, `task-120` |
| `init` scaffold and messages | `task-118`, `task-119` |
| `memory.yaml` | `task-114`, and the out-of-flow `dl-088` change |

| Wave | Tasks | Starts when |
|---|---|---|
| **W1** | `task-109` (`bug-137`), `task-110` (`dl-107`) | now |
| **W2** | `task-111` (`bug-075`), **alone** | W1 merged into `main` |
| **W3** | `task-112` (`dl-095`, `dl-026`), `task-113` (`adr-011`, `bug-136`), `task-114` (`dl-123`), `task-118` (`bug-139`), `task-121` (`dl-096`), `task-122` (`bug-021`) | W2 merged |
| **W4** | `task-115` (`dl-093`), `task-117` (`bug-138`), `task-119` (`bug-140`, `bug-129`) | the W3 task that holds the same file is merged (`112` for `117`, `118` for `119`) |
| **W5** | `task-120` (`bug-128`); `task-116` (the slug) | `119` merged for `120`; `113`, `115` and the approver's repository transfer for `116` |

- **W1 is narrow on purpose.** The approver chose `109 + 110` alone, over a wider W1 that also
  pulled in `118`, `121` and `122`, so that `task-111` reaches `main` as early as possible. v0.3 may
  start only once `task-111` is on `main` (`dl-092`, parallel-release rule (a)).
- **W2 is a barrier.** `task-111` moves `docs/self/.wingfoil/` and `docs/self/docs/04_memory/`, the
  folder every task's own Memory file lives in. No other task is open while it runs.
- The critical path to the publish is `109/110 → 111 → 113 → transfer → 116`.
- Within a wave, tasks run in parallel. A W4/W5 task may start as soon as its own blocker is merged,
  without waiting for the whole previous wave.

**In scope, with no task, and not run by this plan:**
- `dl-088` (the `service` type) is a configuration change after W2 (§6.8 step 4, route (a)). It is
  run by another session, serialized with `task-114` because both edit `memory.yaml` and its
  `version`.
- `bug-092` closes by the approver's `reject [triaged → closed]` after `task-114` merges.

### 3. Paths before and after `task-111`

Until `task-111` merges, task files are under `docs/self/docs/04_memory/v0.2.2/` and the
configuration under `docs/self/.wingfoil/`. After it, they are under `docs/04_memory/v0.2.2/` and
`.wingfoil/`. Tasks from W3 on cite the new paths. This plan's own path (`docs/05_plans/`, at the
repository root) does not move. Untracked files under `docs/self/` and at the root that belong to
other work (`docs/self/X_initial-design-plan.md`, `TODOs.md`, `tools/`) are neither moved nor
deleted.

### 4. `bug.sync_state` — linked bugs

| Task | `bug:` |
|---|---|
| `task-109` | `bug-137` |
| `task-111` | `bug-075` |
| `task-113` | `bug-136` |
| `task-117` | `bug-138` |
| `task-118` | `bug-139` |
| `task-119` | `bug-140`, `bug-129` |
| `task-120` | `bug-128` |
| `task-122` | `bug-021` |

Each bug has exactly one task, so the aggregate rule is 1:1. The bug's `status` changes in the same
commit as the task's transition, on the task branch.

### 5. Known pitfalls, handed over by the release-planning session

- **`task-112`**: the package is named `wingfoil` and the alias `wingfoil-released` also exposes a
  `wingfoil` bin. What `npx wingfoil` and `node_modules/.bin/wingfoil` resolve to is measured, not
  assumed (AC 1).
- **`task-113`**: `act` is missing, and npm 11.6.2 is below the 11.15.0 that `npm stage publish`
  needs. AC 4 is settled with a newer npm (`npx -p npm@latest` or Node ≥ 24.18.0). OIDC and
  `npm stage approve` are provable only by the v0.2.2 publish itself.
- **`task-111`**: rename commits are kept apart from content commits (`git diff -M --stat`).

## Handoff

- **Approver:** the review gate of every task, and the `approve`/`reject` that follows it. The
  repository transfer to `wingfoil/wingfoil` and the trusted publisher on npmjs.com, before
  `task-116`. The reject of `bug-092` after `task-114`. `dl-088`, through another session.
- **Agent:** start → review for each task in wave order, and the `done` mechanics (merge, worktree
  cleanup, bug sync) once the approver has ruled. It never approves.
- **Completion criteria:** the 14 tasks `done` and merged into `main`; their nine linked bugs
  `closed`; `npm test` green with coverage > 80%; this plan `active → done`. Next phase: `user-docs`.
