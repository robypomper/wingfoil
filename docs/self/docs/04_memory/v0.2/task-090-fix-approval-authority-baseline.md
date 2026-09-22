---
id: "task-090-fix-approval-authority-baseline"
type: task
title: "Resolve the approval authority against a committed state, so an `Approver:` line cannot rest on an uncommitted `dna.yaml`"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "security", "audit-trail"]
ref: "bug-079-uncommitted-dna-yaml-grants-approval-authority"
bug: ["bug-079-uncommitted-dna-yaml-grants-approval-authority"]
depends_on: ["task-088-fix-gated-verbs-commit-only-the-status-change"]
tmpl_version: 260703
---

## Description

The approval-authority check reads `dna.yaml` from the working tree, so an **uncommitted** edit
granting the current git identity the `approver` role is enough: `memory approve` proceeds and writes
`Approver: <name> <email> (approver)` into a permanent commit. The commit attests an authority that no
committed state of the repository records.

`task-088` does not close this. Its guard is deliberately *per-path* — it refuses when the **element**
being transitioned is modified — and `dna.yaml` is a different path. The remedy here is not a wider
guard but a different **baseline** for this particular read.

Declared a release blocker for `minor-v0.2`, at `critical`: the release ships the approval verbs, and
**P1.7** requires an approval to record approver identity while `adr-006-git-identity-role-based-authz`
makes that identity the basis of authorisation. An `Approver:` line no committed state supports is the
failure of the guarantee the feature exists to provide.

## Acceptance Criteria

- **AC1** — Reproduce first, on a scratch project, against a build of `main` that already contains
  `task-088` — the point being that its fix does not close this. Record the commands, the resulting
  commit body, and the committed `dna.yaml` at that commit still showing the identity is not an
  approver. A scratch project is required (`bug-075`).
- **AC2** — **Choose the baseline and argue it.** Two shapes, and they are not equivalent:
  - *(a)* resolve authority from the **committed** `dna.yaml` — at `HEAD`, or at the commit being
    produced — so the working tree cannot influence it;
  - *(b)* **refuse** the verb while `dna.yaml` carries uncommitted modifications, following the shape
    `task-088` established for the element.

  Weigh them against what each does to a legitimate flow: a project that has just run `init` and is
  seeding its first approver, a developer editing `dna.yaml` for unrelated reasons mid-review, and a
  CI checkout where nothing is ever dirty. Say what the rejected option would have been better at.
- **AC3** — After the fix, the reproduction from AC1 fails closed: the verb refuses, or resolves the
  authority from the committed state and refuses because the identity is not an approver there. Exit
  code per **`spec-005` §1** — `1` for a well-formed invocation that fails validation; do **not**
  emit `2`, which that spec reserves for a malformed invocation. This was ruled on `bug-076` and
  applies unchanged.
- **AC4** — **The bootstrap case must still work.** A fresh project has `team.members: []` and nobody
  is an approver; whatever you choose must leave a legitimate path to seeding the first approver, and
  a test must pin it. If your choice makes that path awkward, say so plainly rather than declaring it
  out of scope — it is the one flow every new user hits.
- **AC5** — Establish whether any **other** authority or policy read has the same baseline problem —
  `roles.yaml` bindings, and any directive or workflow read that gates behaviour. Report each with the
  command that settles it. Fix only what falls inside this task's argument; file the rest.
- **AC6** — A test pins the defect itself and fails against the current code. State the command
  showing it red before and green after.
- **AC7** — Nothing in this repository's own history is re-verified against the new rule or rewritten.
  Every approval here was made by hand; `dl-035` forbids rewriting merged `wf` commits regardless.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-088`'s Execution Notes first (`dl-015` read_related): it established the guard shape, the
  committed-tree postcondition, and the reasoning for keeping the guard per-path — which is precisely
  why this defect survived it.
- `requireApprovalAuthority` and `readGitIdentity` are the primitives to start from; find their read
  path rather than assuming which file layer serves them.
- `bug-078` covers the same root cause on the **write** side for the non-transition verbs and is *not*
  in scope. If your fix suggests a general rule about which baseline a command reads, that is a
  decision-log worth proposing — propose it, do not enact it.
- Classify every AC per `dl-014`/T1. AC1, AC3 and AC6 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->
