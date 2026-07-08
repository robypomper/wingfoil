---
id: "dl-024-git-branch-tag-conventions"
type: decision-log
title: "Git conventions: one branch per phase; version tag created on main"
status: ready
context: "process"
release: "v0.1"
tmpl_version: 260703
---

## Context

Throughout `rl-v1`'s `minor-v0.1`, the git tree has followed a consistent convention in practice:
every workflow phase ran on its own branch (`design/initial_design`, `design/wingfoil_init`,
`design/release_planning_v0.1`, `design/release_submit_v0.1`, `design/retrospective_v0.1`, ...) and
every `dev-loop` task ran on its own `task/task-NNN-slug` branch (e.g. `task/task-032-readme-cli-
quickstart`, `task/task-033-manual-e2e-journey-validation`), each merged into `main` with
`git merge --ff=false` (`git log --oneline --merges` shows a clean chain of `Merge branch '...'`
commits, one per phase/task). This matches the task-level discipline `dl-002-git-branching-trunk-
based` and `dl-014-dev-loop-plan-deltas` already settled for `dev-loop` branches — but **nothing
codifies the phase-level half of the same convention**, in `workflows/custom/sw-life-cycle.yaml`,
`release-cycle.yaml`, or anywhere else.

The `retro-v0.1` retrospective (`docs/self/docs/04_memory/design/dls/retro-v0.1.md`) flagged this as
finding **N1/N2** ("git rules": one branch per phase; tag on `main`) and named this DL as the vehicle
(disposition table, row `N1/N2`). Two concrete risks motivate it:

1. **Phase branching is convention-by-practice, not a rule.** Nothing in the workflow config states
   that a phase must run on its own branch; an agent following only the phase definitions could just
   as easily commit phase work directly on `main` or on a stale branch.
2. **No rule says where the release tag goes.** `minor-v0.1` never actually got tagged (`dl-018`:
   v0.1 is a "paper release", `release-publishing` was skipped, so there is no `v0.1` tag to check
   against) — but had `release-publishing` run, nothing would have stopped the tag from being cut on
   `design/release_submit_v0.1` (the branch active during that phase) instead of on `main` after the
   merge. A tag on a phase branch is fragile: once that branch is deleted post-merge, the tag either
   dangles or must be recreated, and in the meantime it does not point at the same commit history
   `main` converges on.

A third, minor item surfaced during this review: `git tag -l` shows a stray tag named `1` — an
accidental artifact with no semantic meaning, not attached to any release.

## Decision

*(in-discussion — proposed, not yet ratified)* Codify, as an explicit git convention (not just
practice), two rules:

1. **One branch per phase.** Every `sw-life-cycle` / `release-cycle` phase runs on its own branch
   named `design/<phase>_<version>` (e.g. `design/release_submit_v0.1`), mirroring the existing
   `task/task-NNN-slug` convention for `dev-loop` tasks (`dl-002`/`dl-014`). Each phase branch merges
   into `main` via `git merge --ff=false`, exactly as done throughout `minor-v0.1`.
2. **Version tag on `main`, never on a phase branch.** The `vX.Y` release tag is created on `main`
   **after** the release's final branch (its `release-publishing` phase branch, e.g. a future
   `design/release_publishing_v0.2`) has merged — never on the phase branch itself. This guarantees
   the tag always points at a commit reachable from `main`'s permanent history, independent of
   whether the source branch is later deleted.

Concretely:
- Add a `git:` conventions note to `docs/self/.wingfoil/workflows/custom/sw-life-cycle.yaml` and
  `release-cycle.yaml` stating the one-branch-per-phase rule and branch-naming pattern.
- Add an explicit "tag `vX.Y` on `main`" step to `release-publishing.yaml`, positioned after the merge
  action and before the phase is considered complete.
- Cleanup: delete the stray tag `1` (`git tag -d 1`) — it predates this convention and carries no
  release semantics.

## Rationale

- **Deterministic, auditable git tree.** A convention that lives only in commit history (not in the
  workflow config two independent agents both read) cannot be relied on to reproduce the same tree
  shape across runs — codifying it serves the Determinism Index and the audit-trail intent behind
  P1.x memory commits (REQ-SYS-07).
- **Tags must survive branch cleanup.** A tag on `main` is a stable, permanent release reference; a
  tag on a phase branch is only as durable as that branch, and phase branches are expected to be
  deleted after merge (as task branches already are per `dl-014`). Tagging `main` removes an entire
  class of "tag points at a deleted ref" failure.
- **Consistency with existing practice.** `minor-v0.1` already ran every phase on its own branch and
  merged with `--ff=false` — this decision does not change behavior, it writes down the behavior that
  already produced a clean, reviewable `git log --oneline --merges`.
- **Consistency with `dl-014`.** `dl-014` settled branch/worktree/merge conventions at the *task*
  level (`dev-loop`); this DL is the *phase*-level and *tagging* complement — same shape, different
  granularity, no overlap.
- **Trade-off.** Formalizing existing practice adds a small amount of workflow-config text; the
  alternative — leaving it implicit — is what already left the tag-placement rule unstated and let an
  accidental tag (`1`) through uncaught.

## Actions

- [ ] Ratify (owner: approver).
- [ ] On `ready`: add the one-branch-per-phase note (naming pattern + `--ff=false` merge) to
  `sw-life-cycle.yaml` and `release-cycle.yaml`.
- [ ] On `ready`: add the tag-on-`main` step to `release-publishing.yaml`, after the final merge
  action.
- [ ] Delete the stray tag: `git tag -d 1`.
