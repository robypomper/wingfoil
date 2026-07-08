---
id: "dl-014-dev-loop-plan-deltas"
type: decision-log
title: "Dev-loop git ergonomics (branch/worktree/merge) + API-docs enforcement — supersedes dl-002 on branching/merge"
status: ready
context: "process"
release: ""
tmpl_version: 260703   # Orignal template version
---

## Context

`docs/self/.wingfoil/workflows/custom/dev-loop.yaml` encodes only the bare TDD cycle
(`start → design → red → green → refactor → review → done`) with minimal git actions:
`git.create_branch("{task.id}")` (no naming convention), `git.merge(to: main)` (no strategy, no
declared conflict handling), and `refactor.checks.post` limited to `tests.passing` +
`tests.coverage(min: 80)` (no API-documentation check).

`REQ-INT-06` (Git operations as workflow actions) already anticipates `create worktree` as a
first-class action alongside branch/merge/commit, and already defines the conflict contract at the
spec level: *"a `git.merge` conflict aborts the merge leaving the working tree clean and marks the
step `failed`"*. So worktree isolation and conflict handling are not new decisions to invent — they
are existing spec behavior that `dev-loop.yaml` simply hasn't wired up yet.

**This revisits `dl-002-git-branching-trunk-based` (already `ready`) on branch naming, merge
strategy, and worktree usage.** `dl-002` adopted bare `{task.id}` branches, a plain direct merge to
`main`, and no worktree, explicitly naming branch-name prefixes, `--no-ff`, and worktree conventions
as **"considered and deferred"** — under a "simplicity over convention" rationale that assumed no
concrete need for running tasks in parallel. That assumption no longer holds: the `release-cycle` →
`implementation` phase for `minor-v0.1` is intended to run its 33 backlog tasks either one at a time
or **in parallel**, and a shared working tree with a bare branch cannot isolate two tasks' checkouts
running at once — one task's uncommitted state would collide with another's. `dl-002`'s other
conclusions (one branch per task, direct-to-main merge with no intermediate release branch, main
always releasable) are unaffected and stay in force; only its branch-naming/merge-strategy/worktree
call is superseded here.

**Overlap with `dl-013-documentation-process-gate` (in-discussion):** that DL already decided the
*text* of the API-docs rule — extend the `documentation` directive with "every public/exported
symbol carries a TSDoc comment; `TypeDoc` must build clean; the `dev-loop` review gate rejects any
undocumented public element" — plus a separate release-level `user-docs` phase for user-facing docs.
This DL does **not** re-decide that rule text. It only decides the mechanical piece `dl-013` left
unpinned: *which* `dev-loop` check actually enforces it. `dl-013`'s own rationale says "caught by the
existing `dev-loop` review gate" — but the `review` phase only runs `tests.bdd.run` +
`memory.submit`; the phase that actually owns code-quality checks is `refactor`. This DL corrects
that and wires the check there.

## Decision

**Adopt the following changes to `dev-loop.yaml` and its supporting config — G1–G3 explicitly
supersede `dl-002`'s branch-naming/merge-strategy/worktree conclusions; G4–G5 are additive and don't
touch anything `dl-002` decided:**

| # | Change | Where | How |
|---|---|---|---|
| **G1** | Branch naming *(supersedes `dl-002`)* | `dev-loop.yaml` `start` phase | Parametrize directly in the action call: `git.create_branch("task/{task.id}")`. No new `dna.yaml` convention block — the former `conventions:` section was already removed (per `spec-002`); a literal action argument is the current-schema way to express this. |
| **G2** | Per-task worktree isolation *(supersedes `dl-002`)* | `dev-loop.yaml` `start`/`done` phases | `start` gains `git.create_worktree("task/{task.id}")`; `done` gains `git.remove_worktree` after the merge, before branch delete. Exercises `REQ-INT-06`'s existing `create worktree` action — no new action needs to be defined. Enables running multiple tasks' dev-loops in parallel without one clobbering another's working tree. |
| **G3** | Merge strategy *(supersedes `dl-002`)* | `dev-loop.yaml` `done` phase | Parametrize `git.merge(to: main, ff: false)` (always a merge commit) — keeps each parallel task's history as a distinct, revertible unit even when a branch could fast-forward. |
| **G4** | Merge-conflict fallback | `dev-loop.yaml` `done` phase | No new procedure to invent — rely on `REQ-INT-06`'s existing fit criterion (conflict aborts the merge, working tree stays clean, step marked `failed`). Add `fallback: { step: red, set_state: in-progress }` on `done`, mirroring `review`'s existing fallback shape, so a failed merge routes the task back to `red` instead of stalling with undefined behavior. |
| **G5** | API-docs check (reconciled with `dl-013`) | `dev-loop.yaml` `refactor.checks.post` | Add `docs.api.public-complete` and `docs.api.build`, enforcing the rule `dl-013` already decided — this DL does not restate or re-approve that rule text, only wires its enforcement into the correct phase. |

## Rationale

- **Concrete new need, not scope creep.** `dl-002` deferred branch-prefix/worktree/`--no-ff` because
  it saw no need for parallel task execution. `release-cycle`'s `implementation` phase for
  `minor-v0.1` is explicitly meant to support parallel dev-loops over its 33 tasks — that need now
  exists, so the trade-off `dl-002` made no longer applies to this specific point. Its other three
  conclusions (one branch per task, direct merge, no intermediate release branch) are untouched.
- **Spec-grounded, not invented.** G2 and G4 aren't new design — `REQ-INT-06` already specifies
  worktree creation and the abort-on-conflict contract; this DL is wiring, not spec work.
- **Determinism.** Parallel task execution without worktree isolation risks one task's uncommitted
  state leaking into another's — declaring the isolation in the shared workflow config (not per-plan
  prose) keeps every release's `implementation` phase behaving identically regardless of how many
  tasks run concurrently.
- **Single owner per decision.** `dl-013` owns the API-docs rule's *content*; this DL owns *where in
  `dev-loop` it's checked*. Keeping that split explicit avoids two DLs each claiming to edit
  `directives/custom/documentation.md`.
- **Supersede narrowly, don't discard `dl-002` wholesale.** `dl-002`'s branching-atomicity and
  direct-to-main-merge conclusions remain correct and are reused here unchanged; only the specific
  points this DL has new information about are revisited.
- **Alternatives considered.**
    - *Leave branch/merge behavior as `dl-002` left it, drop G1–G3* — rejected: blocks parallel task
      execution, which the `implementation` phase is meant to support.
    - *Invent a bespoke conflict-resolution procedure (abort → merge main into the worktree branch →
      resolve → re-merge)* — rejected in favor of the simpler, already-specified `REQ-INT-06` contract
      (abort cleanly, mark step `failed`, let the workflow's own fallback mechanism handle recovery).
    - *Restate the API-docs rule text here too* — rejected: duplicates `dl-013`; this DL only adds the
      enforcement wiring `dl-013` left open.

## Actions

*Executed only after approval; each traces back to this DL.*

- [ ] `dev-loop.yaml`: `start` → `git.create_branch("task/{task.id}")` + `git.create_worktree("task/{task.id}")`;
  `done` → `git.merge(to: main, ff: false)` + `git.remove_worktree` + `fallback: { step: red, set_state: in-progress }`;
  `refactor.checks.post` += `docs.api.public-complete`, `docs.api.build` — owner: tech-lead / architect.
- [ ] Confirm `git.create_worktree` / `git.remove_worktree` action semantics against `REQ-INT-06`
  (no new requirement text needed, only an implementation note if behavior needs clarifying) —
  owner: architect.
- [ ] `dna.yaml` `stacks.technologies` — add **TypeDoc** as the API-docs build tool — owner: architect.
- [ ] `task-001-nodejs-typescript-scaffold` — add TypeDoc + doc-coverage tooling to scope — owner: developer.
- [ ] **Depends on `dl-013`**: do not land the `refactor.checks.post` doc checks (G5) before
  `dl-013`'s directive-text change is itself approved — otherwise `dev-loop` would enforce a rule the
  `documentation` directive doesn't yet state.
- [ ] **Once this DL is approved**, `memory.deprecate(dl-002, reason: "branch-naming/merge-strategy/
  worktree conclusions superseded by dl-014 to support parallel task execution")` — moves `dl-002`
  `ready → deprecated`. Not executed by an agent autonomously; only when the `approver` role
  explicitly instructs it, same as `memory.approve`/`memory.reject` (CLAUDE.md §5.1/§8).
- [ ] This DL advances `ready → in-develop` when `release-planning` derives the task(s) implementing
  the actions above, and `in-develop → done` once those tasks are `done` — per `decision-log`'s own
  state machine (`dl-012-decision-log-state-machine`).
