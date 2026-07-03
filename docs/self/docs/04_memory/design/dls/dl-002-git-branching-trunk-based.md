---
id: dl-002-git-branching-trunk-based
type: decision-log
title: "Trunk-based development for rl-v1 delivery"
status: in-discussion
context: "process"
release: ""
tmpl_version: 260703
---

## Context

rl-v1 delivery requires a clear, deterministic git branching strategy that aligns with the task-centric development loop (dev-loop.yaml) and minimizes integration friction. The strategy must support one-task-per-branch atomicity while keeping the main branch releasable.

## Decision

Adopt **trunk-based development** for rl-v1 delivery:

1. **One short-lived branch per task**: Each task creates a feature branch named `{task.id}` at the start of the dev-loop (`start` phase).
2. **Direct merge to main**: After review approval (end of the `review` phase), merge the task branch directly to main with no intermediate release branch or staging branch.
3. **No long-lived release branches**: There are no separate release/* or develop branches; all delivery flows through main.
4. **Main is always releasable**: The main branch gates release eligibility via the release-cycle workflow's `release-publishing` phase; no branch-specific preconditions.

## Rationale

Trunk-based development minimizes integration overhead and is well-suited to WingFoil's atomic task-per-branch model:

- **Minimal branching ceremony**: One branch per task reduces cognitive load and merge-conflict surface area compared to multi-tier strategies (e.g., main + develop + release/*).
- **Alignment with dev-loop atomicity**: The dev-loop workflow already prescribes exactly one action per phase; trunk-based development extends that discipline to git, encoding one commit pattern (branch → work → review → merge).
- **Deterministic delivery**: Short-lived branches (on the order of days per task) reduce the likelihood of stale branches and long-running merge conflicts, supporting the Determinism Index requirement that independent runs from the same specs produce substantially equivalent software.
- **Release flexibility**: The release-cycle workflow's `release-publishing` phase decides what subset of main to tag and ship; no branch structure enforces release boundaries, allowing patch releases, hotfixes, and version lines to coexist without branch management overhead.
- **Simplicity over convention**: The strategy prescribes only what dev-loop.yaml already requires (git.create_branch, git.merge); it does not add branch-name prefixes, --no-ff flags, or worktree conventions, all of which were considered and deferred.

## Actions

None — this decision formalizes the branching discipline already encoded in dev-loop.yaml; no implementation work is required.
