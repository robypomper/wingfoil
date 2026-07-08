---
id: dl-002-git-branching-trunk-based
type: decision-log
title: "Trunk-based development for rl-v1 delivery"
status: ready
context: "process"
release: ""
tmpl_version: 260703
---

> **Partially superseded by `dl-014-dev-loop-plan-deltas` (approved 2026-07-08).** `dl-014` revised
> only the **branch-naming** (now `task/{task.id}`, not bare `{task.id}`), the **merge strategy** (now
> `git.merge(ff: false)` — always a merge commit), and **worktree** usage (a per-task worktree is now
> created), to support parallel task execution. **Everything else here stays in force:** one
> short-lived branch per task, direct-to-main merge with no intermediate release/staging branch, no
> long-lived release branches, main always releasable. The "considered and deferred" clause in the
> Rationale (branch prefixes / `--no-ff` / worktree) is **reversed by `dl-014`**. This DL is **not
> deprecated** — its trunk-based decision still holds.

## Context

rl-v1 delivery requires a clear, deterministic git branching strategy that aligns with the task-centric development loop (dev-loop.yaml) and minimizes integration friction. The strategy must support one-task-per-branch atomicity while keeping the main branch releasable.

## Decision

Adopt **trunk-based development** for rl-v1 delivery:

1. **One short-lived branch per task**: Each task creates a feature branch at the start of the dev-loop (`start` phase). *(Naming updated by `dl-014`: `task/{task.id}`, not bare `{task.id}`; a per-task worktree is also created.)*
2. **Direct merge to main**: After review approval (end of the `review` phase), merge the task branch directly to main with no intermediate release branch or staging branch. *(Merge strategy updated by `dl-014`: `git.merge(ff: false)` — always a merge commit.)*
3. **No long-lived release branches**: There are no separate release/* or develop branches; all delivery flows through main.
4. **Main is always releasable**: The main branch gates release eligibility via the release-cycle workflow's `release-publishing` phase; no branch-specific preconditions.

## Rationale

Trunk-based development minimizes integration overhead and is well-suited to WingFoil's atomic task-per-branch model:

- **Minimal branching ceremony**: One branch per task reduces cognitive load and merge-conflict surface area compared to multi-tier strategies (e.g., main + develop + release/*).
- **Alignment with dev-loop atomicity**: The dev-loop workflow already prescribes exactly one action per phase; trunk-based development extends that discipline to git, encoding one commit pattern (branch → work → review → merge).
- **Deterministic delivery**: Short-lived branches (on the order of days per task) reduce the likelihood of stale branches and long-running merge conflicts, supporting the Determinism Index requirement that independent runs from the same specs produce substantially equivalent software.
- **Release flexibility**: The release-cycle workflow's `release-publishing` phase decides what subset of main to tag and ship; no branch structure enforces release boundaries, allowing patch releases, hotfixes, and version lines to coexist without branch management overhead.
- **Simplicity over convention** *(superseded by `dl-014`)*: The strategy originally prescribed only
  what dev-loop.yaml required (git.create_branch, git.merge) and deferred branch-name prefixes,
  `--no-ff`, and worktree conventions. **`dl-014` reverses that deferral** — parallel task execution
  created the concrete need — so branch prefixes (`task/`), `--ff=false`, and per-task worktrees are
  now adopted. The rest of the trunk-based decision (atomic one-branch-per-task, direct-to-main merge,
  main always releasable) stands.

## Actions

None — this decision formalizes the branching discipline already encoded in dev-loop.yaml; no implementation work is required.
