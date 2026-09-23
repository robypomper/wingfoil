---
id: "task-091-reads-resolve-at-head"
type: task
title: "Resolve the state machine and the role catalogue from the committed repository, per dl-080's ratified read rule"
status: pending
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "directives", "security", "audit-trail"]
ref: "dl-080-which-baseline-each-command-reads"
bug: ["bug-081-memory-yaml-read-from-worktree-fabricates-states", "bug-082-directive-assign-validates-role-against-worktree"]
depends_on: ["task-090-fix-approval-authority-baseline"]
tmpl_version: 260703
---

## Description

`dl-080-which-baseline-each-command-reads` is `ready`, ratified as option **(B)**: **a read that gates
an operation resolves against the repository as committed at `HEAD`**, and a write refuses while its
target carries modifications it does not own. This task lands the **read** half for the two remaining
instances.

- **`bug-081`** (`critical`): the state machine is read from the working tree, so an uncommitted
  `memory.yaml` edit decides what transition a verb performs and what status it writes — through
  `memory submit`, which is **ungated** — and leaves the element in a status the committed machine
  rejects, so no verb can move it afterwards.
- **`bug-082`**: `directive assign` validates `--role` against the working-tree role catalogue and
  commits a `roles.yaml` binding to a role the committed `dna.yaml` does not define, breaking
  **REQ-SYS-08**'s referential integrity.

Both are release blockers for `minor-v0.2`. `task-090` already did this for the authority read and is
the pattern to follow: it changed the **baseline** rather than adding a guard, by removing the
parameter through which a working-tree document could reach the decision at all.

## Acceptance Criteria

- **AC1** — Reproduce both defects first, on scratch projects, against a build of current `main`, and
  record the commands. A scratch project is required — `bug-075` means the verbs cannot be pointed at
  this repository's own Memory. `bug-081`'s reproduction must show the fabricated status **committed**
  and the element unmovable afterwards; `bug-082`'s must show the committed `dna.yaml` lacking the role
  the committed `roles.yaml` now binds.
- **AC2** — After the fix, both reads resolve at `HEAD`. Follow `task-090`'s shape: make the
  working-tree document **unreachable** from the decision rather than guarding against it, so no
  present or future call path can reintroduce the defect. If that is not possible for one of the two,
  say why in the design notes rather than substituting a guard silently.
- **AC3** — Refusals exit **`1`**, per `spec-005` §1 as ruled on `bug-076`: a well-formed invocation
  failing validation. Not `2`.
- **AC4** — **The bootstrap and the ordinary flows must still work**, each pinned by a test:
  `wingfoil init` commits the scaffold, so `HEAD` always carries a `memory.yaml`; a project whose
  committed machine is valid must transition normally; and adding a role then committing it then
  assigning a directive to it must succeed. Establish what an **absent or unreadable committed**
  `memory.yaml` means and choose fail-closed or fail-open deliberately — `task-090` chose fail-closed
  for `dna.yaml` and its reasoning is the precedent, not the rule.
- **AC5** — Sweep for **other** gating reads with the same baseline: the workflow layer, directive
  resolution, anything that decides whether an operation is legal. Report each with the command that
  settles it. Fix what this task's argument covers; list the rest as proposed elements.
- **AC6** — Tests pin both defects and fail against the current code. State the command showing each
  red before and green after.
- **AC7** — Nothing in this repository's own history is re-verified against the new rule or rewritten
  (`dl-035`).
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-090`'s Execution Notes first (`dl-015` read_related): the baseline-versus-guard argument,
  the `loadDnaYamlAtHead` shape, and the fail-closed reasoning are all there, and `dl-080`'s
  ratification cites them.
- `bug-081` is the one to fix first inside this task: it is `critical`, reachable without authority,
  and it strands artefacts.
- `bug-082` may be the harder design: a role catalogue is legitimately extended while assigning, and
  under `dl-080`(B) that becomes edit, commit, then assign. That is accepted and is not this task's to
  re-litigate — `dl-081` ratified the verbs that will make it one command, and `task-093` builds them.
- Classify every AC per `dl-014`/T1. AC1, AC2, AC3 and AC6 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->
