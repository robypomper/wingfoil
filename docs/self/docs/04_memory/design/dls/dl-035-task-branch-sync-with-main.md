---
id: "dl-035-task-branch-sync-with-main"
type: decision-log
title: "How a task branch that has fallen behind main is brought current: merge, never rebase"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Three decision-logs already cover the git shape of a `dev-loop` task: `dl-002-git-branching-trunk-based`
(trunk-based discipline), `dl-014-dev-loop-plan-deltas` G1–G4 (branch `task/{task.id}`, per-task
worktree, `--no-ff` merge, abort-clean on a failed merge), and `dl-024-git-branch-tag-conventions`
(the phase-level complement and tag placement). Between them they settle how a branch is *created*,
where work *happens*, how it *merges*, and where tags *go*.

**None of them says what to do when a task branch falls behind `main` before it merges.** That was
theoretical while `dev-loop` ran serially. It is not theoretical now:

- The v0.2 review gate returned **seven** tasks to `red` (`034`, `035`, `036`, `037`, `042`, `043`,
  `044`). They resume on branches created before that gate ran.
- `main` moved underneath them in the meantime: three task merges (`task-038`, `task-040`,
  `task-041`), the document amendments implementing seven ratified decision-logs, and two new tasks.
- When `task-035` resumed, its branch was **55 commits behind `main`**. Worse, the work it was
  resuming had been redefined by `dl-028-archived-states-excluded-from-context`, which requires it to
  supersede `isDeprecatedStatus` — a symbol that only exists on `main` because `task-038` merged
  while `task-035` sat in `red`. The task could not do its job without first taking `main` in.

The choice was made ad hoc, in the moment, and it should be a rule instead: two independent agents
resuming two rejected tasks must not pick differently.

A second, quieter problem rides along. A task's review gate reports "all green" for the tree on its
branch. If that tree is dozens of commits stale, the green says very little about the tree the merge
will actually produce — `task-035`'s first pass measured a baseline that no longer exists.

## Decision

*(in-discussion — proposed, not yet ratified)*

1. **Merge `main` into the task branch. Never rebase a branch carrying `wf(*)` commits.**
   `git merge --no-edit main` from inside the task's worktree; the resulting merge commit stays on the
   task branch and is carried into `main` by G3's final `--no-ff` merge as before.
2. **When.** At two points: (a) whenever a task **resumes** after a review-gate rejection, before any
   `red` work — the resumed pass must be written against the tree it will merge into; and (b)
   immediately before `review` re-submits, if `main` has moved since (a), so the gate numbers describe
   a tree that will actually exist.
3. **Conflicts** follow `dl-014` G4's existing shape: abort clean, and if the conflict is not
   trivially resolvable by the developer, the task returns to `red` with the conflict recorded in its
   Execution Notes rather than being force-resolved.
4. **Record it.** The sync is a plain `Merge branch 'main' into task/{task.id}` commit; the task's
   Execution Notes name what came in when it materially changed the task's work (as `dl-028` did for
   `task-035`).

Alternatives considered:

- **(a) Rebase the task branch onto `main`.** Rejected — see Rationale; it destroys audit records.
- **(b) Rebase only the code commits, preserving the `wf(*)` ones.** Rejected as not mechanically
  achievable: the state-transition commits are interleaved with the code commits by construction
  (`start` … `test`/`feat`/`refactor` … `submit`), so no contiguous range can be replayed without
  touching them.
- **(c) Never sync; resolve everything at the final merge.** Rejected. It concentrates all conflict
  risk at the moment of merging, which is exactly where G4 says to abort rather than fight — and it
  leaves the review gate certifying a tree that will not exist. It is also simply impossible when the
  task's own definition depends on something merged meanwhile, as `task-035` demonstrates.
- **(d) Squash-merge task branches**, making staleness cheap. Rejected: it collapses the per-commit
  audit trail that P1.2/P1.7/P1.10 depend on, and contradicts `dl-014` G3.

## Rationale

- **The decisive argument is the audit trail, and it is specific to this project.** In WingFoil a
  state transition *is* a git commit: `memory.approve`/`memory.reject` carry the approver identity and
  the reason in the commit **body**, and the commit's timestamp is the ISO-8601 record (P1.2, P1.7),
  which `wingfoil memory history` is specified to surface (P1.10). A rebase rewrites every one of
  those commits' hashes. In an ordinary repository that is a cosmetic concern about history
  tidiness; here it rewrites the evidence. `task-035`'s branch carries a
  `wf(task): reject … [in-review → in-progress]` commit whose body names the approver and the reason —
  rebasing would replace that record with a copy.
- **A merge commit on the task branch costs nothing that G3 cares about.** G3 wants each task to land
  on `main` as one revertible unit; reverting the task's `--no-ff` merge commit still removes exactly
  that task's work, whether or not `main` was merged inward first.
- **Freshness is what makes the review gate mean something.** The gate's whole output is a set of
  measurements — tests, coverage, `docs.api`, and now lint. Measurements taken on a stale tree
  describe a hypothetical. Requiring the sync before re-submit is what turns the gate's green into a
  statement about the tree that will exist after merge.
- **Trade-off accepted:** the resulting history is not linear, and a task branch that syncs twice
  carries two inward merge commits. That is noise in `git log --graph`. It is the price of not
  rewriting audit records, and `git log --oneline --merges` — the view `dl-024` cares about — stays
  readable because inward merges are named differently from the outward `Merge branch 'task/…'` ones.
- **Why this could not simply be inferred:** an agent reading `dl-002`, `dl-014` and `dl-024` finds
  trunk-based discipline and a clean linear-ish history described approvingly, which points *toward*
  rebase. The audit-trail constraint that overrides it is stated in P1.7/P1.10, in a different part of
  the specification, and nothing connects the two. That gap is the reason this DL exists.

## Actions

- Owner **approver**: ratify or amend.
- Owner **developer**: add the sync rule to `.wingfoil/workflows/custom/dev-loop.yaml` — as an action
  on the `red` phase (or on the review `fallback`), and cite this DL inline.
- Owner **developer**: document it in `docs/05_plans/rl-v1/rel-v0.2/dev-loop-rel-v0.2-plan.md` §2,
  next to the existing branch/worktree/merge conventions.
- Applies immediately to the six task branches still in `red` (`034`, `036`, `037`, `042`, `043`,
  `044`); `task-035` already had `main` merged in under this rule before it resumed.
- Related: `dl-002` (trunk-based), `dl-014` G1–G4 (task git ergonomics), `dl-024` (phase branches and
  tags) — this is their missing fourth piece.
