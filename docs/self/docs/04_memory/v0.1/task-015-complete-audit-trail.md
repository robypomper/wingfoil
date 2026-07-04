---
id: "task-015-complete-audit-trail"
type: task
title: "Infrastructure: REQ-SEC-02 — Complete, attributable audit trail"
status: backlog
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-SEC-02"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Ensure that 100% of state changes across every pillar are recorded in git with author and ISO-8601
timestamp, and that approvals/rejections additionally record a reason — with no secondary state
store to keep in sync. Because state is derived directly from each document's own frontmatter
`status:` field (there is no `.wingfoil/state/` index), the git commit *is* the audit trail: every
`memory.add/submit/approve/reject/deprecate` operation produces exactly one commit, scoped to one
element type, whose author + commit timestamp supply attribution, and whose message body carries the
approver identity and reason for gated transitions. As Morgan (the auditor persona), I want to run
`git log` over `.wingfoil/`-managed content and see 0 commits with an unknown author, and be able to
list any element's full transition history with author, timestamp, and reason for every step.

## Acceptance Criteria

Per REQ-SEC-02's fit criterion: "`git log` verification over all `.wingfoil/` changes shows author +
timestamp for every change with **0** \"unknown author\"; `memory history` lists each transition with
author, timestamp, and reason."

Testable breakdown:
- Every commit touching a Memory/DNA/Directives/Workflow file has a non-empty, valid git author
  (name + email) — 0 "unknown author" commits across the managed tree.
- Every commit's timestamp is the git commit timestamp (ISO-8601), never a value written into the
  file content itself.
- `memory.approve`/`memory.reject` commits carry, in the commit body, an explicit `Approver:` line
  (full identity as `Name <email> (role)`) and a `Reason:` line — both mandatory, sourced from the
  invoking `--reason` argument (shared requirement with REQ-SEC-04).
- `memory history <id>` (once implemented) lists every transition for that element in order, each
  annotated with author, ISO-8601 timestamp, and reason (where applicable) — reconstructed entirely
  from git log, not from a separate log file.
- Recomputing an element's state at any historical commit (via frontmatter at that commit) always
  agrees with the transition history derived from git log at that point — no drift between the two
  views (shared grounding with REQ-SYS-03/REQ-STATE-02).
- See BDD `p1-memory/P1.2-versioning-audit-trail.feature`, `p1-memory/P1.7-memory-approve.feature`,
  `p1-memory/P1.8-memory-reject.feature`, `p1-memory/P1.10-memory-history.feature`.

## Implementation Notes

- Architectural backing: `docs/self/docs/04_memory/design/adrs/adr-007-stateless-state-derivation.md`
  — state is derived from frontmatter, not a separate index; git history is the sole audit trail for
  transitions, so there is nothing else to keep consistent with it.
- Storage grounding: `docs/self/docs/04_memory/design/adrs/adr-001-git-backed-storage.md` — every
  state change is a git commit with author + timestamp by construction (REQ-SYS-01); no external
  database or log store.
- Depends on `task-014-git-identity-required` (REQ-SEC-01) for attribution to be possible at all —
  build/verify that task first.
- Related feature tasks that depend on this in this release: `task-019-implement-versioning-audit-trail`
  (backlog `TASK-017`, P1.2); the `memory approve`/`memory reject`/`memory history` feature tasks
  (backlog `TASK-041`/`TASK-042`/`TASK-044`, P1.7/P1.8/P1.10) land in later releases but must build on
  the commit-message conventions fixed here.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
