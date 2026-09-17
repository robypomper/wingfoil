---
id: "dev-loop-rel-v0.2-plan"
type: plan
title: "Dev-loop — v0.2 (Project Directives + role-based context + publishing pipeline)"
status: active
version: "1.0"
workflow: "dev-loop"
phase: "rel-v0.2"
element: "minor-v0.2"
release: "v0.2"
tmpl_version: 260703
---

## Context

`minor-v0.2` (`docs/self/docs/04_memory/planning/rl-v1/minor-v0.2.md`) is `in-development`; its
`planning` phase is complete (`release-planning-rel-v0.2-plan.md`) — **32 backlog tasks**
(`task-034..065`, `docs/self/docs/04_memory/v0.2/`), all `status: backlog`, tag `v0.2`. Per
`release-cycle` (`.wingfoil/workflows/custom/release-cycle.yaml` v1.1) the next phase is
**`implementation`**: one `dev-loop` sub-workflow run
(`.wingfoil/workflows/custom/dev-loop.yaml` **v1.3**, `element: task`) per backlog task tagged
`v0.2`, `where: { status: [backlog], tags: ["v0.2"] }`. Per CLAUDE.md §6-interim + §10.7 (no
workflow engine yet) and `dl-019`, this `plan` element is that phase's coherent, reusable execution
scaffold.

Like v0.1's dev-loop plan, `dev-loop` runs **once per task** (32×). Rather than 32 near-identical
plans, this single document is the **generic plan** every run follows; it is *adapted, not
rewritten*, per task — the per-task content and the running log live in each task's own **Execution
Notes** section (see §1). This mirrors `X_wingfoil-init-plan.md` and the v0.1 dev-loop plan.

> **What changed since v0.1.** v0.1's dev-loop plan carried heavy "forcing ahead of approval" notes
> because `dl-013` (doc gate), `dl-014` (dev-loop plan deltas: `task/` branches, per-task worktree,
> `--no-ff` merge, G4 merge-conflict fallback, G5 API-docs check, T1 AC classification) and `dl-015`
> (inter-task dependency notes) were all `in-discussion`. **All three are now `ready`, and
> `dev-loop.yaml` is at v1.3 with them absorbed.** So this plan simply *follows `dev-loop.yaml` v1.3
> as configured* — there is nothing to force. The only staged item remaining is the `docs.api.*`
> check ramp, closed by `task-062` (see §2).

> **Dogfooding note:** the `wingfoil` CLI/MCP is not implemented. Every state transition below is
> performed manually (edit frontmatter + git commit); commit subjects simulate the `wingfoil`
> commands that will issue them once the tool exists. Unlike v0.1 (partly "on paper"), v0.2 builds on
> a **real `src/` tree** already merged from v0.1 (`core, storage, memory, dna, directives, workflow,
> cli, mcp, validation`) — dev-loop runs produce real TypeScript + Jest tests.

**Preconditions (see §4 checklist):** `minor-v0.2` `in-development`; 32 tasks `backlog`; the design
inputs they cite — `adr-009` `accepted`, `spec-013/014/015` `approved`, `dl-018` `ready`,
`REQ-SYS/PERF/STATE/INT/SEC-*` — already exist; `bug-004/006/007` `planned` (each with one fix task);
`bug-005` `closed`.

**Produces:** all 32 tasks `backlog → done`; `bug-004/006/007` `planned → … → closed` via
`bug.sync_state`; real code + tests under `src/` with coverage ≥ 80%. On completion the release-cycle
advances to its **`user-docs`** phase (dl-013) — *not* part of this plan.

---

## 1. How this plan is used per task

An agent picking up a task does **not** copy this file. Instead:

1. Read this plan for the phase-by-phase contract (§3) and the git/commit conventions (§2).
2. Open the task's own Memory file (`docs/self/docs/04_memory/v0.2/task-{n}-{slug}.md`) — its
   **Description / Acceptance Criteria / Implementation Notes** carry the task-specific content, and
   its **Execution Notes** section is the running log filled in incrementally, phase by phase (T1 AC
   classification, `depends_on` acknowledgements, specs found missing, deviations, rejection reasons).
3. Execute the phases against that task, committing per §2.

The task's own Memory file is the single per-task adaptation surface — no second per-task plan file
is created (same rationale as the v0.1 dev-loop plan).

---

## 2. Conventions

### Branch, worktree & merge (`dl-014` G1–G4, `dl-024` — all `ready`; matches `dev-loop.yaml` v1.3)

- **Branch — `task/{task.id}`** (e.g. `task/task-034-role-based-binding`), created from `main` at
  `start` via `git.create_branch("task/{task.id}")` (`dl-014` G1).
- **Worktree — per-task.** `start` creates a dedicated worktree via
  `git.create_worktree("task/{task.id}")` (`dl-014` G2, exercising `REQ-INT-06`); `done` removes it
  via `git.remove_worktree` after the merge, before branch delete. Worktrees enable parallel
  dev-loops; when running serially they still isolate each task's history.
- **Merge — `--no-ff`, last.** `done` commits `approve` (`in-review → approved`) and the `done`
  transition (`approved → done`) **on `task/{task.id}` itself**, then `git.merge(to: main, ff: false)`
  carries both into `main` as one merge commit (`dl-014` G3).
- **Merge conflict / failed merge (`dl-014` G4):** abort clean (`REQ-INT-06`), route back to `red`
  with the task reset to `in-progress` — the `done` phase now has this fallback (unlike v0.1, where
  it was flagged as missing).

### Commits

- **Memory state-transition commits** (`memory.add`/`submit`/`approve`/`reject`) — exactly per
  CLAUDE.md §5.1. Approver-gated commits (`approve`/`reject`) carry the `Approver:`/`Reason:` body and
  run **only on Roberto's explicit instruction** (§4/§8).
- **Code commits** (conventional commits; `{module}` = a `dna.yaml` module — `core, storage, memory,
  dna, directives, workflow, cli, mcp, validation`):

  | Phase | Subject format |
  |---|---|
  | red | `test({module}): {task.id} — failing test for <criteria>` |
  | green | `feat({module}): {task.id} — <minimum implementation>` |
  | refactor | `refactor({module}): {task.id} — <what changed>` |

### Roles & directives (per `roles.yaml`; auto-loaded on execution, P3.6)

| Phase | Role | Directives auto-loaded |
|---|---|---|
| start, red, green, refactor, done | developer | code-quality, testing, determinism |
| design | architect | architecture, determinism, traceability |
| review | reviewer | code-review, traceability |
| design / review approval gates | approver | — (approval authority only) |

Global (every phase): doc-versioning, documentation, security-secrets.

### Quality-gate checks on `refactor` — `docs.api.*` (ramp closed) and `lint.clean` (`dl-034`)

`refactor`'s `docs.api.public-complete` / `docs.api.build` checks run **warn / new-code-only** until
**`task-062-typedoc-tsdoc-backfill`** lands the TypeDoc/TSDoc backfill + build wiring; from the task
that immediately follows `task-062` onward they **flip to hard-reject**. Recommendation: schedule
`task-062` early in the loop (it has no `depends_on`) so most tasks are authored under the hard-reject
regime — but that is a sequencing preference, not a dependency.

### `bug.sync_state` — live for the three fix tasks only

`bug.sync_state(for_each: task.bug)` is a no-op unless the task's `bug:` field names at least one
bug. Since **`dl-045-absorbed-bug-back-reference`** that field is a **list**, and it covers two cases:
a fix task derived from a bug by release-planning, and a bug **absorbed** into an existing task's
Acceptance Criteria because that task already owns the ground. A bug no task names there can never
leave `triaged` — `triaged`/`planned` are `waiting` states and the only reject edge to `closed`
starts from `open`.

Derived fix tasks, all three now `done` and merged:

| Fix task | `bug:` | Bug state today |
|---|---|---|
| task-063-fix-dna-set-comment-preservation | bug-004-dna-set-strips-yaml-comments | planned |
| task-064-fix-init-directive-scaffold-schema | bug-006-init-directive-scaffold-schema-invalid | planned |
| task-065-fix-commander-esm-jest-harness | bug-007-commander-esm-jest-untestable | planned |

Absorbed bugs (dl-045) — the host task already owned the ground, so no dedicated fix task was
created. `bug-018` was absorbed while `task-054` was already in flight, so its chain was reconstructed
retroactively per dl-045 sub-question 3; the other three are recorded **before** their host task
starts, so no reconstruction is needed:

| Host task | absorbed `bug:` | why that task |
|---|---|---|
| task-054-project-directives (`done`) | bug-018-init-storage-bypasses-integrity-guard | its `scaffoldFiles()` change is what makes the unguarded write path reachable |
| task-045-memory-submit | bug-016-stale-pass2-exit-code-tsdoc | already owns dl-032's realignment in the same call path |
| task-046 | bug-017-agent-authority-guarantee-untested | wires `requireApprovalAuthority`; the missing characterization test belongs there |
| task-061 | bug-015-scan-reads-worktree-not-index | already cites spec-007 and the scanner |

`dl-015`'s `read_related` covers `depends_on` tasks, **not** decision-logs — so dl-045's outcome must
be handed to task-045, task-046 and task-061 explicitly at their design step, or the absorption will
not be recorded and those three bugs will stick at `triaged` exactly as bug-018 did.

Each bug has exactly **one** fix task, so the aggregate rule collapses to 1:1: the bug advances
`planned → in-progress` (task `start`), `→ in-review` (task `review`), `→ resolved → closed` (task
`done`). Keep each bug's frontmatter `status` in sync within the fix task's own commits.

---

## 3. Phase-by-phase plan (mirrors `dev-loop.yaml` v1.3 exactly)

### 3.1 `start` — role: developer

- `git.create_branch("task/{task.id}")` from `main`; `git.create_worktree("task/{task.id}")`.
- `element.set_state(in-progress)` — task: `backlog → in-progress`.
- `bug.sync_state` — for task-063/064/065 only, advances the linked bug `planned → in-progress`.

### 3.2 `design` — role: architect (safety net, not a rubber stamp)

- `agent.classify_acs` (T1, `dl-014` + testing directive) — classify each acceptance criterion as
  **red-first** (new behavior) or **characterization** (behavior pre-exists); record in the task's
  Execution Notes. Characterization ACs are exempt from `red`'s failing-test requirement.
- `agent.read_related` (`dl-015`, **HARD gate**) — load and acknowledge the Execution Notes of every
  `depends_on` task in the task's Execution Notes **before** `red`. Blocks `red` until done. The
  `depends_on` graph is in §4; e.g. task-060 must read task-059's notes, task-046 must read
  task-040's + task-041's.
- `agent.verify_specs` — check task scope against existing `tech-spec` elements. For each still-missing
  artefact: `memory.add(type: tech-spec)` → `memory.submit` (`draft → pending`).
- **Checks (post):** `frontmatter.required: [title, scope]`; `tech-spec.approved` (all relevant specs
  approved); `depends_on.acknowledged`.
- **Approval:** `by_role: approver` — **only** when a new spec was scaffolded (otherwise pass-through).
  **Fallback:** reject → `design` (revise spec, re-verify).
- Most v0.2 tasks cite an already-approved `ref` (`spec-013/014/015`, `adr-009`, a `REQ-*`, a `dl-*`),
  so `design` is expected to pass straight through for them — same as v0.1.

### 3.3 `red` — role: developer

- `agent.execute` — write a failing test capturing the task's red-first ACs (reference the relevant
  BDD `.feature` under `docs/02_requirements/02_bdd/features/`).
- **Checks (post):** `tests.exist`; `tests.failing(for: red-first ACs)` — characterization ACs (T1)
  are exempt (no fabricated red, no dead code to force one).

### 3.4 `green` — role: developer

- `agent.execute` — minimum implementation to pass. **Checks (post):** `tests.passing`.

### 3.5 `refactor` — role: developer

- `agent.execute` — refactor with tests green.
- **Checks (post):** `tests.passing`; `tests.coverage(min: 80)`; `docs.api.public-complete`,
  `docs.api.build`; **`lint.clean`**.
- `docs.api.*` is **ACTIVE hard-reject** since `task-062` closed its ramp (§2). `lint.clean` is
  **ACTIVE hard-reject from the start** — no ramp — per `dl-034-lint-gate-in-dev-loop`, added to
  `dev-loop.yaml` v1.3 by `task-066-fix-eslint-baseline-and-lint-gate`. It is backed by
  `npm run lint` exiting 0 and asserted by `test/lint/lint-clean.test.ts`; an eslint error in any
  file fails `refactor`.

### 3.6 `review` — role: reviewer

- `tests.bdd.run` — the task's BDD acceptance suite must pass.
- `memory.submit` — task: `in-progress → in-review`.
- `bug.sync_state` — task-063/064/065: linked bug `in-progress → in-review`.
- **Checks (pre):** `tests.bdd.passing`.
- **Approval:** `by_role: approver`. **Fallback:** reject → `red`, task reset to `in-progress`.

### 3.7 `done` — role: developer

Both state-transition commits land **on `task/{task.id}` before merge** (so the merged branch is the
one that actually reaches `done`):

1. `memory.approve` — task: `in-review → approved`, committed on `task/{task.id}` (§5.1 body:
   `Approver:`/`Reason:`).
2. `element.set_state(done)` — task: `approved → done`, committed on `task/{task.id}`.
3. `git.merge(to: main, ff: false)` — carries both commits into `main` as one merge commit.
4. `git.remove_worktree`, then `git.branch.delete("task/{task.id}")`.
5. `bug.sync_state` — task-063/064/065: linked bug `in-review → resolved → closed`.

**Fallback (`dl-014` G4):** conflicted/failed merge → abort clean, back to `red`, task `in-progress`.

---

## 4. Task registry & execution order (snapshot — source of truth is `docs/self/docs/04_memory/v0.2/task-*.md`)

32 tasks, all `status: backlog`, tag `v0.2`. The `depends_on` graph defines a topological order;
within a wave order is free. Recommend running `task-062` in Wave 1 to flip `docs.api.*` to
hard-reject early (§2).

**Wave 1 — no `depends_on` (infra + independents):**
`task-034` (REQ-SYS-08 role-based binding), `task-035` (REQ-PERF-05), `task-036` (REQ-STATE-01),
`task-037` (REQ-STATE-05), `task-038` (REQ-STATE-06), `task-039` (REQ-INT-02 MCP-prompts infra),
`task-040` (REQ-SEC-03), `task-041` (REQ-SEC-04), `task-042` (REQ-SEC-07), `task-043` (REQ-SEC-08),
`task-044` (REQ-SEC-10), `task-049` (P1.10 memory-history), `task-050` (P3.1 directive-create),
`task-053` (P3.4 directives-list), `task-054` (P3.5 project-directives), `task-059` (publish-metadata),
`task-062` (TypeDoc/TSDoc backfill — run early), `task-063` (fix bug-004), `task-064` (fix bug-006),
`task-065` (fix bug-007).

**Wave 2 — depend on Wave 1:**
`task-045` → task-036 · `task-046` → task-040, task-041 · `task-047` → task-041 ·
`task-048` → task-035, task-038, task-041 · `task-051` → task-034 · `task-052` → task-042 ·
`task-055` → task-037, task-039 · `task-056` → task-034 · `task-057` → task-043, task-044 ·
`task-058` → task-039 · `task-060` → task-059.

**Wave 3 — depend on Wave 2:**
`task-061` → task-060.

This table is a derived snapshot for readability — do not edit it in place of the task files.

---

## 5. Preconditions / launch checklist

- [x] `minor-v0.2` — `status: in-development`.
- [x] All 32 tasks — `status: backlog`, required frontmatter (`title, release`) present, `depends_on`
  set (§4).
- [x] Design inputs accepted/approved/ready: `adr-009` `accepted`; `spec-013/014/015` `approved`;
  `dl-013/014/015/016/017/018/024` `ready`; the cited `REQ-*` exist — `design` safety net should find
  no gap for tasks whose `ref`/scope those already cover.
- [x] `bug-004/006/007` `planned` (release `v0.2`), each with one fix task → `bug.sync_state` live for
  task-063/064/065; `bug-005` `closed`.
- [x] Real `src/` tree from v0.1 present (`core, storage, memory, dna, directives, workflow, cli, mcp,
  validation`) + `package.json` — dev-loop produces real code, not paper.
- [x] **Running.** `task-062` done+merged; `task-038`/`task-040`/`task-041` done+merged; seven tasks
  (`034`, `035`, `036`, `037`, `042`, `043`, `044`) returned to `in-progress` by the review gate and
  awaiting a second pass; the rest still `backlog`. `main` is green at 60 suites / 576 tests.

Next: start **`task-062`** (early, to flip `docs.api.*`) or any Wave-1 task; then follow the §4
topological order.

---

## 6. Open items

- **`docs.api.*` flip — CLOSED.** `task-062` landed the backfill and flipped the checks to ACTIVE
  hard-reject; no staged check remains in this plan.
- **`lint.clean` — ACTIVE** since `task-066` (`dl-034`), hard-reject from the start, no ramp.
- **`user-docs` / `e2e-smoke` (release-cycle phases, not this plan):** dl-013's `user-docs` gate and
  dl-023's `e2e-smoke` gate run **after** `implementation` completes, before `submit`. They are
  separate `release-cycle` phases with their own plans — out of scope here.
- **No forcing:** unlike the v0.1 dev-loop plan, nothing here diverges from `dev-loop.yaml`/the
  decision-logs — dl-013/014/015 are all `ready` and absorbed into `dev-loop.yaml` v1.1.
